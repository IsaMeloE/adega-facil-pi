import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const paymentLabels = {
  FIADO: "Fiado",
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
};

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function GET(request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return Response.json(
        { error: "Acesso não autorizado." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (
      !isValidDateOnly(from) ||
      !isValidDateOnly(to) ||
      from > to
    ) {
      return NextResponse.json(
        { error: "Informe um período válido para o relatório." },
        { status: 400 },
      );
    }

    // O período considera o horário de Brasília.
    const startDate = new Date(`${from}T00:00:00.000-03:00`);
    const endDate = new Date(`${nextDate(to)}T00:00:00.000-03:00`);

    const [sales, customers] = await Promise.all([
      prisma.sale.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          total: true,
          paymentMethod: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              unitPrice: true,
              product: {
                select: { name: true },
              },
            },
          },
          lines: {
            select: {
              productId: true,
              quantity: true,
              baseQuantity: true,
              unitPrice: true,
              product: {
                select: { name: true },
              },
            },
          },
        },
      }),
      prisma.customer.findMany({
        select: {
          creditMovements: {
            select: {
              type: true,
              amount: true,
            },
          },
        },
      }),
    ]);

    let revenueCents = 0;
    let unitsSold = 0;
    const paymentsByMethod = new Map();
    const productsById = new Map();

    for (const sale of sales) {
      const saleTotalCents = toCents(sale.total);
      revenueCents += saleTotalCents;

      const method = sale.paymentMethod || "NAO_INFORMADO";
      const payment = paymentsByMethod.get(method) || {
        paymentMethod: method,
        label: paymentLabels[method] || "Não informado",
        totalCents: 0,
      };
      payment.totalCents += saleTotalCents;
      paymentsByMethod.set(method, payment);

      if (sale.lines?.length) {
        for (const line of sale.lines) {
          unitsSold += line.baseQuantity;

          const product = productsById.get(line.productId) || {
            productId: line.productId,
            name: line.product.name,
            quantity: 0,
            totalCents: 0,
          };

          product.quantity += line.baseQuantity;
          product.totalCents += toCents(line.unitPrice) * line.quantity;
          productsById.set(line.productId, product);
        }
      } else {
        for (const item of sale.items) {
          unitsSold += item.quantity;

          const product = productsById.get(item.productId) || {
            productId: item.productId,
            name: item.product.name,
            quantity: 0,
            totalCents: 0,
          };

          product.quantity += item.quantity;
          product.totalCents += toCents(item.unitPrice) * item.quantity;
          productsById.set(item.productId, product);
        }
      }
    }

    const openCreditCents = customers.reduce((total, customer) => {
      let chargesCents = 0;
      let paymentsCents = 0;

      for (const movement of customer.creditMovements) {
        if (movement.type === "CHARGE") {
          chargesCents += toCents(movement.amount);
        } else if (movement.type === "PAYMENT") {
          paymentsCents += toCents(movement.amount);
        }
      }

      return total + Math.max(0, chargesCents - paymentsCents);
    }, 0);

    const topProducts = [...productsById.values()]
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 5)
      .map((product) => ({
        ...product,
        total: product.totalCents / 100,
        totalCents: undefined,
      }));

    const paymentDistribution = [...paymentsByMethod.values()].map((payment) => ({
      ...payment,
      total: payment.totalCents / 100,
      totalCents: undefined,
    }));

    return NextResponse.json({
      from,
      to,
      revenue: revenueCents / 100,
      salesCount: sales.length,
      unitsSold,
      openCreditBalance: openCreditCents / 100,
      topProducts,
      paymentDistribution,
    });
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);

    return NextResponse.json(
      { error: "Não foi possível gerar o relatório." },
      { status: 500 },
    );
  }
}