import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

function safePct(n: number, d: number): number {
  if (d === 0) return 0;
  return Math.round((n / d) * 1000) / 10; // 1 decimal
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0); // month is 1-based here; day 0 = last day of prev month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const channel = searchParams.get("channel") ?? "ALL";
  const dateFromParam = searchParams.get("date_from");
  const dateToParam = searchParams.get("date_to");
  const monthParam = searchParams.get("month"); // YYYY-MM

  let date_from: string;
  let date_to: string;

  if (dateFromParam && dateToParam) {
    date_from = dateFromParam;
    date_to = dateToParam;
  } else if (monthParam) {
    const [y, m] = monthParam.split("-").map(Number);
    date_from = `${monthParam}-01`;
    date_to = lastDayOfMonth(y, m);
  } else {
    // Default: current month
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const mm = String(m).padStart(2, "0");
    date_from = `${y}-${mm}-01`;
    date_to = lastDayOfMonth(y, m);
  }

  // Start of 12-month trend window (always global — not channel-filtered for expenses)
  const trendWindowStart = new Date();
  trendWindowStart.setMonth(trendWindowStart.getMonth() - 11);
  trendWindowStart.setDate(1);
  const trendExpStart = `${trendWindowStart.getFullYear()}-${String(trendWindowStart.getMonth() + 1).padStart(2, "0")}-01`;

  const [pnlRes, trendRes, expensesRes, trendExpensesRes] = await Promise.all([
    supabaseAdmin.rpc("get_pnl_data", {
      p_date_from: date_from,
      p_date_to: date_to,
      p_channel: channel,
    }),
    supabaseAdmin.rpc("get_pnl_monthly_trend", {
      p_months_back: 11,
      p_channel: channel,
    }),
    supabaseAdmin
      .from("expenses")
      .select("function_name, total_amount")
      .gte("expense_date", date_from)
      .lte("expense_date", date_to),
    supabaseAdmin
      .from("expenses")
      .select("function_name, total_amount, expense_date")
      .gte("expense_date", trendExpStart),
  ]);

  if (pnlRes.error) {
    return NextResponse.json({ error: pnlRes.error.message }, { status: 500 });
  }
  if (trendRes.error) {
    return NextResponse.json({ error: trendRes.error.message }, { status: 500 });
  }
  if (expensesRes.error) {
    return NextResponse.json({ error: expensesRes.error.message }, { status: 500 });
  }
  if (trendExpensesRes.error) {
    return NextResponse.json({ error: trendExpensesRes.error.message }, { status: 500 });
  }

  const raw = pnlRes.data?.[0] ?? {
    gross_revenue: 0, total_discounts: 0, shipping_revenue: 0,
    net_revenue: 0, cogs: 0, order_count: 0, rto_count: 0,
  };

  const gross_revenue = Number(raw.gross_revenue);
  const total_discounts = Number(raw.total_discounts);
  const shipping_revenue = Number(raw.shipping_revenue);
  const net_revenue = Number(raw.net_revenue);
  const cogs = Number(raw.cogs);
  const order_count = Number(raw.order_count);
  const rto_count = Number(raw.rto_count);

  const gross_profit = net_revenue - cogs;
  const gross_margin_pct = safePct(gross_profit, net_revenue);

  // Aggregate expenses by function
  const byFn: Record<string, number> = {};
  for (const row of expensesRes.data ?? []) {
    byFn[row.function_name] = (byFn[row.function_name] ?? 0) + Number(row.total_amount);
  }

  const logistic = byFn["LOGISTIC"] ?? 0;
  const packaging = byFn["PACKAGING"] ?? 0;
  const payment_gateway = byFn["PAYMENT_GATEWAY"] ?? 0;
  const cm2 = gross_profit - logistic - packaging - payment_gateway;
  const cm2_margin_pct = safePct(cm2, net_revenue);

  const marketing = byFn["MARKETING"] ?? 0;
  const cm3 = cm2 - marketing;
  const cm3_margin_pct = safePct(cm3, net_revenue);

  const employee = byFn["EMPLOYEE"] ?? 0;
  const software = byFn["SOFTWARE"] ?? 0;
  const miscellaneous = byFn["MISCELLANEOUS"] ?? 0;
  const ebitda = cm3 - employee - software - miscellaneous;
  const ebitda_margin_pct = safePct(ebitda, net_revenue);

  const rto_rate_pct = safePct(rto_count, order_count);

  return NextResponse.json({
    revenue: {
      gross_revenue,
      total_discounts,
      shipping_revenue,
      net_revenue,
      cogs,
      gross_profit,
      gross_margin_pct,
      order_count,
    },
    expenses: {
      logistic,
      packaging,
      payment_gateway,
      cm2,
      cm2_margin_pct,
      marketing,
      cm3,
      cm3_margin_pct,
      employee,
      software,
      miscellaneous,
      ebitda,
      ebitda_margin_pct,
    },
    rto: { rto_count, rto_rate_pct },
    trend: (() => {
      // Build monthly expense map keyed by "YYYY-MM-01"
      const monthlyExp: Record<string, Record<string, number>> = {};
      for (const row of trendExpensesRes.data ?? []) {
        const key = (row.expense_date as string).substring(0, 7) + "-01";
        if (!monthlyExp[key]) monthlyExp[key] = {};
        monthlyExp[key][row.function_name] = (monthlyExp[key][row.function_name] ?? 0) + Number(row.total_amount);
      }
      return (trendRes.data ?? []).map((r: { month_start: string; month_label: string; net_revenue: number; cogs: number; gross_profit: number }) => {
        const exp = monthlyExp[r.month_start] ?? {};
        const nr = Number(r.net_revenue);
        const cm1 = Number(r.gross_profit);
        const cm2 = cm1 - (exp["LOGISTIC"] ?? 0) - (exp["PACKAGING"] ?? 0) - (exp["PAYMENT_GATEWAY"] ?? 0);
        const cm3 = cm2 - (exp["MARKETING"] ?? 0);
        const ebitda = cm3 - (exp["EMPLOYEE"] ?? 0) - (exp["SOFTWARE"] ?? 0) - (exp["MISCELLANEOUS"] ?? 0);
        return {
          month_label: r.month_label,
          net_revenue: nr,
          cm1,
          cm2,
          cm3,
          ebitda,
        };
      });
    })(),
    meta: {
      date_from,
      date_to,
      channel,
      cogs_note:
        "COGS uses current cost prices, not historical. If cost was updated after the order, figures may differ from actual margin at time of sale.",
    },
  });
}
