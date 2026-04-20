import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Regex-список денежных полей, на которых запрещено прямое использование
 * Number(). Они должны проходить через `@/lib/money` helpers (toMoney, sum,
 * sub, mul, div) или конвертироваться на границе API через `.toNumber()`.
 *
 * Добавлено в Phase 7 Plan 3 (hotspot migration) — предотвращает регрессию
 * на BUG-069 / BUG-078 (float precision loss в финансовых расчётах).
 *
 * Scope: на данный момент применяется только к 5 hotspot-файлам
 * (sales, shifts, orders, motivation-calculation, repairs). Остальные
 * `src/actions/**` и компоненты — задача следующих итераций (deferred).
 */
const MONEY_FIELDS =
  "sellPrice|costPrice|price|total|amount|finalAmount|discountAmount|cashReceived|changeAmount|openingCash|closingCash|expectedCash|discrepancy|prepaidAmount|purchasePrice|deliveryCost|estimatedCost|agreedCost|finalCost|bonus|commission|rate|crossBonuses|repairBonuses|returns|dailyTotal|commissions|totalAmount|cashSales|cashWithdrawals|cashDeposits";

const MONEY_ERROR_MESSAGE =
  "Не используй Number() на денежных полях. Импортируй { toMoney, sum, mul, sub, div } from '@/lib/money', либо используй метод .toNumber() на Prisma.Decimal для serialize на границе API.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Money guard: запрет Number() на денежных полях в 5 hotspot-файлах.
  {
    files: [
      "src/actions/sales.ts",
      "src/actions/shifts.ts",
      "src/actions/orders.ts",
      "src/actions/motivation-calculation.ts",
      "src/actions/repairs.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `CallExpression[callee.name='Number'][arguments.0.type='Identifier'][arguments.0.name=/^(${MONEY_FIELDS})$/]`,
          message: MONEY_ERROR_MESSAGE,
        },
        {
          selector: `CallExpression[callee.name='Number'][arguments.0.type='MemberExpression'][arguments.0.property.name=/^(${MONEY_FIELDS})$/]`,
          message: MONEY_ERROR_MESSAGE,
        },
      ],
    },
  },
]);

export default eslintConfig;
