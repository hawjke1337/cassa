export const PERMISSIONS = {
  // Catalog
  CATALOG_VIEW: { code: "catalog.view", module: "catalog", name: "Просмотр каталога" },
  CATALOG_EDIT: { code: "catalog.edit", module: "catalog", name: "Редактирование товаров" },
  CATALOG_DELETE: { code: "catalog.delete", module: "catalog", name: "Удаление товаров" },
  CATALOG_PRICES: { code: "catalog.prices", module: "catalog", name: "Просмотр закупочных цен" },

  // POS
  POS_SELL: { code: "pos.sell", module: "pos", name: "Продажа" },
  POS_RETURN: { code: "pos.return", module: "pos", name: "Возврат товара" },
  POS_DISCOUNT: { code: "pos.discount", module: "pos", name: "Применение скидки" },
  POS_DISCOUNT_HIGH: { code: "pos.discount_high", module: "pos", name: "Скидка свыше 30%" },
  POS_REPORTS: { code: "pos.reports", module: "pos", name: "Отчёты кассы" },

  // Inventory
  INVENTORY_VIEW: { code: "inventory.view", module: "inventory", name: "Просмотр остатков" },
  INVENTORY_RECEIVE: { code: "inventory.receive", module: "inventory", name: "Приём товара" },
  INVENTORY_TRANSFER: { code: "inventory.transfer", module: "inventory", name: "Перемещение" },
  INVENTORY_AUDIT: { code: "inventory.audit", module: "inventory", name: "Инвентаризация" },
  INVENTORY_WRITEOFF: { code: "inventory.writeoff", module: "inventory", name: "Списание" },

  // Orders
  ORDERS_VIEW: { code: "orders.view", module: "orders", name: "Просмотр заказов" },
  ORDERS_CREATE: { code: "orders.create", module: "orders", name: "Создание заказов" },
  ORDERS_MANAGE: { code: "orders.manage", module: "orders", name: "Управление заказами" },
  ORDERS_COSTS: { code: "orders.costs", module: "orders", name: "Просмотр закупочных цен заказов" },
  ORDERS_MANAGE_COSTS: {
    code: "orders.manage_costs",
    module: "orders",
    name: "Ввод закупочных цен заказов",
  },

  // Repairs
  REPAIRS_VIEW: { code: "repairs.view", module: "repairs", name: "Просмотр ремонтов" },
  REPAIRS_CREATE: { code: "repairs.create", module: "repairs", name: "Приём устройств" },
  REPAIRS_MANAGE: { code: "repairs.manage", module: "repairs", name: "Управление ремонтами" },
  REPAIRS_WARRANTY: { code: "repairs.warranty", module: "repairs", name: "Гарантийные обращения" },

  // Suppliers
  SUPPLIERS_VIEW: { code: "suppliers.view", module: "suppliers", name: "Просмотр поставщиков" },
  SUPPLIERS_EDIT: {
    code: "suppliers.edit",
    module: "suppliers",
    name: "Редактирование поставщиков",
  },
  SUPPLIERS_PAY: {
    code: "suppliers.pay",
    module: "suppliers",
    name: "Оплата долгов поставщикам",
  },

  // Reports
  REPORTS_SALES: { code: "reports.sales", module: "reports", name: "Отчёты по продажам" },
  REPORTS_INVENTORY: { code: "reports.inventory", module: "reports", name: "Отчёты по складу" },
  REPORTS_PROFIT: { code: "reports.profit", module: "reports", name: "Отчёты по прибыли" },
  REPORTS_FULL: { code: "reports.full", module: "reports", name: "Полные отчёты (все магазины)" },

  // Settings
  SETTINGS_STORES: { code: "settings.stores", module: "settings", name: "Управление магазинами" },
  SETTINGS_USERS: { code: "settings.users", module: "settings", name: "Управление пользователями" },
  SETTINGS_ROLES: { code: "settings.roles", module: "settings", name: "Управление ролями" },
  SETTINGS_TEMPLATES: {
    code: "settings.templates",
    module: "settings",
    name: "Шаблоны документов",
  },

  // Motivation
  MOTIVATION_GROUPS_MANAGE: {
    code: "motivation.groups.manage",
    module: "motivation",
    name: "Управление мотивационными группами",
  },
  MOTIVATION_SCHEMES_MANAGE: {
    code: "motivation.schemes.manage",
    module: "motivation",
    name: "Управление схемами мотивации",
  },
  MOTIVATION_SCHEMES_ASSIGN: {
    code: "motivation.schemes.assign",
    module: "motivation",
    name: "Назначение схем сотрудникам",
  },
  MOTIVATION_SCHEMES_APPROVE: {
    code: "motivation.schemes.approve",
    module: "motivation",
    name: "Подтверждение изменений схем",
  },
  MOTIVATION_PAYROLL_VIEW: {
    code: "motivation.payroll.view",
    module: "motivation",
    name: "Просмотр расчётов по всем сотрудникам",
  },
  MOTIVATION_PAYROLL_OWN: {
    code: "motivation.payroll.own",
    module: "motivation",
    name: "Просмотр своей мотивации",
  },
  MOTIVATION_PAYROLL_MANAGE: {
    code: "motivation.payroll.manage",
    module: "motivation",
    name: "Управление расчётами зарплат",
  },
  MOTIVATION_PAYROLL_CONFIRM: {
    code: "motivation.payroll.confirm",
    module: "motivation",
    name: "Подтверждение расчётов",
  },
  MOTIVATION_PAYROLL_PAY: {
    code: "motivation.payroll.pay",
    module: "motivation",
    name: "Выплата зарплат",
  },

  // Customers
  CUSTOMERS_VIEW: { code: "customers.view", module: "customers", name: "Просмотр клиентов" },
  CUSTOMERS_MANAGE: { code: "customers.manage", module: "customers", name: "Управление клиентами" },

  // Trade-in
  TRADEIN_ACCEPT: { code: "tradein.accept", module: "tradein", name: "Приём устройств (трейд-ин)" },
  TRADEIN_VIEW: { code: "tradein.view", module: "tradein", name: "Просмотр трейд-ина" },
  TRADEIN_MANAGE: { code: "tradein.manage", module: "tradein", name: "Управление трейд-ином" },
  TRADEIN_DELETE: { code: "tradein.delete", module: "tradein", name: "Удаление трейд-ина" },

  // Shifts
  SHIFTS_OPEN: { code: "shifts.open", module: "shifts", name: "Открытие смены" },
  SHIFTS_CLOSE: { code: "shifts.close", module: "shifts", name: "Закрытие смены" },
  SHIFTS_VIEW: { code: "shifts.view", module: "shifts", name: "Просмотр своих смен" },
  SHIFTS_VIEW_ALL: {
    code: "shifts.view_all",
    module: "shifts",
    name: "Просмотр всех смен магазина",
  },
  SHIFTS_CASH_OPS: { code: "shifts.cash_ops", module: "shifts", name: "Операции с наличными" },
  SHIFTS_OVERRIDE_DISCREPANCY: {
    code: "shifts.override_discrepancy",
    module: "shifts",
    name: "Подтверждение большого расхождения",
  },

  // Funds
  FUNDS_MANAGE: { code: "funds.manage", module: "funds", name: "Управление фондами" },

  // Warranty
  WARRANTY_VIEW: {
    code: "warranty.view",
    module: "warranty",
    name: "Просмотр гарантийных обращений",
  },
  WARRANTY_CREATE: {
    code: "warranty.create",
    module: "warranty",
    name: "Создание гарантийных обращений",
  },
  WARRANTY_MANAGE: {
    code: "warranty.manage",
    module: "warranty",
    name: "Управление гарантийными обращениями",
  },

  // Serial tracking
  SERIAL_VIEW: { code: "serial.view", module: "serial", name: "Просмотр серийных единиц" },
  SERIAL_SEARCH: { code: "serial.search", module: "serial", name: "Поиск по IMEI/SN" },
  SERIAL_EDIT: { code: "serial.edit", module: "serial", name: "Редактирование IMEI/SN" },
} as const

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]["code"]

export const ROLE_PRESETS = {
  owner: {
    name: "Владелец",
    description: "Полный доступ ко всем магазинам",
    isSystem: true,
    permissions: Object.values(PERMISSIONS).map((p) => p.code),
  },
  director: {
    name: "Директор",
    description: "Полный доступ к своему магазину",
    isSystem: true,
    permissions: Object.values(PERMISSIONS)
      .filter((p) => p.code !== "reports.full" && p.code !== "settings.stores")
      .map((p) => p.code),
  },
  seller: {
    name: "Продавец",
    description: "Касса и просмотр остатков",
    isSystem: true,
    permissions: [
      "catalog.view",
      "pos.sell",
      "pos.return",
      "pos.discount",
      "inventory.view",
      "orders.view",
      "orders.create",
      "repairs.view",
      "repairs.create",
      "customers.view",
      "customers.manage",
      "tradein.view",
      "tradein.accept",
      "shifts.open",
      "shifts.close",
      "shifts.view",
      "shifts.cash_ops",
      "serial.view",
      "serial.search",
      "warranty.view",
      "warranty.create",
      "motivation.payroll.own",
    ],
  },
  purchaser: {
    name: "Закупщик",
    description: "Закупки и поставщики",
    isSystem: true,
    permissions: [
      "catalog.view",
      "catalog.edit",
      "catalog.prices",
      "inventory.view",
      "inventory.receive",
      "inventory.transfer",
      "orders.view",
      "orders.manage",
      "orders.costs",
      "orders.manage_costs",
      "suppliers.view",
      "suppliers.edit",
      "suppliers.pay",
      "reports.inventory",
      "motivation.payroll.own",
    ],
  },
  warehouse: {
    name: "Кладовщик",
    description: "Склад и инвентаризация",
    isSystem: true,
    permissions: [
      "catalog.view",
      "inventory.view",
      "inventory.receive",
      "inventory.transfer",
      "inventory.audit",
      "inventory.writeoff",
      "reports.inventory",
      "serial.view",
      "serial.search",
      "serial.edit",
      "motivation.payroll.own",
    ],
  },
  master: {
    name: "Мастер",
    description: "Ремонт и гарантия",
    isSystem: true,
    permissions: [
      "catalog.view",
      "repairs.view",
      "repairs.create",
      "repairs.manage",
      "repairs.warranty",
      "serial.view",
      "serial.search",
      "warranty.view",
      "warranty.create",
      "warranty.manage",
      "motivation.payroll.own",
    ],
  },
  courier: {
    name: "Курьер",
    description: "Доставки и заказы",
    isSystem: true,
    permissions: ["orders.view", "motivation.payroll.own"],
  },
} as const
