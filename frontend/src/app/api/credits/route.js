import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { toCents } from "@/lib/money";

const paymentMethods = [
  "PIX",
  "DINHEIRO",
  "CARTAO_DEBITO",
  "CARTAO_CREDITO",
];

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return Response.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    const customers = await prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        creditMovements: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            amount: true,
            paymentMethod: true,
            notes: true,
            createdAt: true,
            sale: {
              select: {
                id: true,
                createdAt: true,
                items: {
                  select: {
                    quantity: true,
                    product: {
                      select: { name: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const accounts = customers.map((customer) => {
      const chargesCents = customer.creditMovements
        .filter((movement) => movement.type === "CHARGE")
        .reduce((total, movement) => total + toCents(movement.amount), 0);

      const paymentsCents = customer.creditMovements
        .filter((movement) => movement.type === "PAYMENT")
        .reduce((total, movement) => total + toCents(movement.amount), 0);

      const reversalsCents = customer.creditMovements
        .filter((movement) => movement.type === "REVERSAL")
        .reduce((total, movement) => total + toCents(movement.amount), 0);

      const balanceCents = chargesCents - paymentsCents - reversalsCents;

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        balance: balanceCents / 100,
        movements: customer.creditMovements,
      };
    });

    const totalOpenBalanceCents = accounts.reduce(
      (total, account) => total + Math.max(0, toCents(account.balance)),
      0,
    );

    return NextResponse.json({
      accounts,
      totalOpenBalance: totalOpenBalanceCents / 100,
    });
  } catch (error) {
    console.error("Erro ao consultar fiados:", error);

    return NextResponse.json(
      { error: "Não foi possível consultar os fiados." },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  let body;

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return Response.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "O corpo da requisição deve ser JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Informe os dados do pagamento." },
      { status: 400 },
    );
  }

  const customerId =
    typeof body.customerId === "string" ? body.customerId.trim() : "";
  const amount = Number(body.amount);
  const amountCents = Math.round(amount * 100);
  const paymentMethod =
    typeof body.paymentMethod === "string" ? body.paymentMethod : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  if (
    !customerId ||
    !Number.isFinite(amount) ||
    amountCents <= 0 ||
    Math.abs(amount * 100 - amountCents) > 0.000001
  ) {
    return NextResponse.json(
      { error: "Informe o cliente e um valor válido para o pagamento." },
      { status: 400 },
    );
  }

  if (!paymentMethods.includes(paymentMethod)) {
    return NextResponse.json(
      { error: "Selecione uma forma válida para o recebimento." },
      { status: 400 },
    );
  }

  try {
    const payment = await prisma.$transaction(
      async (tx) => {
        const customer = await tx.customer.findUnique({
          where: { id: customerId },
          select: { id: true, isActive: true },
        });

        if (!customer || !customer.isActive) {
          throw Object.assign(
            new Error("Cliente não encontrado ou inativo."),
            { status: 404 },
          );
        }

        const charges = await tx.creditMovement.aggregate({
          where: { customerId, type: "CHARGE" },
          _sum: { amount: true },
        });

        const payments = await tx.creditMovement.aggregate({
          where: { customerId, type: "PAYMENT" },
          _sum: { amount: true },
        });

        const reversals = await tx.creditMovement.aggregate({
          where: { customerId, type: "REVERSAL" },
          _sum: { amount: true },
        });

        const balanceCents =
          toCents(charges._sum.amount) -
          toCents(payments._sum.amount) -
          toCents(reversals._sum.amount);

        if (balanceCents <= 0) {
          throw Object.assign(
            new Error("Esse cliente não possui saldo em aberto."),
            { status: 409 },
          );
        }

        if (amountCents > balanceCents) {
          throw Object.assign(
            new Error("O pagamento não pode ser maior que o saldo em aberto."),
            { status: 400 },
          );
        }

        return tx.creditMovement.create({
          data: {
            customerId,
            type: "PAYMENT",
            amount: amountCents / 100,
            paymentMethod,
            notes: notes || null,
          },
        });
      },
      { isolationLevel: "Serializable" },
    );

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    if (error.status) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error.code === "P2034") {
      return NextResponse.json(
        { error: "A conta foi atualizada. Atualize os dados e tente novamente." },
        { status: 409 },
      );
    }

    console.error("Erro ao registrar pagamento de fiado:", error);

    return NextResponse.json(
      { error: "Não foi possível registrar o pagamento." },
      { status: 500 },
    );
  }
}