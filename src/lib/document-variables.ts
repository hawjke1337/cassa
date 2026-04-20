import { DocumentType } from "@/lib/validations/document-templates"

// ---- Interfaces ----

export interface VariableDefinition {
  key: string
  label: string
  isMoney?: boolean
  isDate?: boolean
}

export interface TableColumnDefinition {
  key: string
  label: string
  defaultWidth: string
  defaultAlign: "left" | "center" | "right"
  isMoney?: boolean
}

export interface DocumentTypeConfig {
  variables: VariableDefinition[]
  tableColumns: TableColumnDefinition[]
  hasTable: boolean
  titleTemplate: string
}

// ---- Configs per document type ----

const SALE_RECEIPT_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Название магазина" },
    { key: "storeAddress", label: "Адрес магазина" },
    { key: "storePhone", label: "Телефон магазина" },
    { key: "number", label: "Номер документа" },
    { key: "date", label: "Дата", isDate: true },
    { key: "sellerName", label: "Продавец" },
    { key: "totalAmount", label: "Сумма без скидки", isMoney: true },
    { key: "discountAmount", label: "Скидка", isMoney: true },
    { key: "finalAmount", label: "Итоговая сумма", isMoney: true },
    { key: "paymentMethods", label: "Способы оплаты" },
  ],
  tableColumns: [
    { key: "productName", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "productSku", label: "Артикул", defaultWidth: "80px", defaultAlign: "left" },
    { key: "imei", label: "IMEI / SN", defaultWidth: "130px", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    { key: "price", label: "Цена", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
    {
      key: "discount",
      label: "Скидка",
      defaultWidth: "80px",
      defaultAlign: "right",
      isMoney: true,
    },
    { key: "total", label: "Сумма", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "ТОВАРНЫЙ ЧЕК №{{number}}",
}

const ORDER_FORM_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Название магазина" },
    { key: "number", label: "Номер документа" },
    { key: "date", label: "Дата", isDate: true },
    { key: "sellerName", label: "Продавец" },
    { key: "clientName", label: "Имя клиента" },
    { key: "clientPhone", label: "Телефон клиента" },
    { key: "clientEmail", label: "Email клиента" },
    { key: "totalAmount", label: "Сумма заказа", isMoney: true },
    { key: "prepaidAmount", label: "Предоплата", isMoney: true },
    { key: "remainingAmount", label: "Остаток к оплате", isMoney: true },
    { key: "estimatedDays", label: "Срок выполнения (дней)" },
  ],
  tableColumns: [
    { key: "name", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    { key: "price", label: "Цена", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
    { key: "total", label: "Сумма", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "БЛАНК ЗАКАЗА №{{number}}",
}

const RECEIVE_DOC_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Название магазина" },
    { key: "supplierName", label: "Поставщик" },
    { key: "number", label: "Номер документа" },
    { key: "date", label: "Дата", isDate: true },
    { key: "receivedByName", label: "Принял" },
    { key: "totalAmount", label: "Итоговая сумма", isMoney: true },
  ],
  tableColumns: [
    { key: "productName", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    {
      key: "costPrice",
      label: "Себестоимость",
      defaultWidth: "100px",
      defaultAlign: "right",
      isMoney: true,
    },
    { key: "total", label: "Сумма", defaultWidth: "100px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "ПРИХОДНАЯ НАКЛАДНАЯ №{{number}}",
}

const WRITE_OFF_DOC_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Название магазина" },
    { key: "number", label: "Номер документа" },
    { key: "date", label: "Дата", isDate: true },
    { key: "reason", label: "Причина списания" },
    { key: "createdByName", label: "Составил" },
    { key: "totalAmount", label: "Итоговая сумма", isMoney: true },
  ],
  tableColumns: [
    { key: "productName", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    {
      key: "costPrice",
      label: "Себестоимость",
      defaultWidth: "100px",
      defaultAlign: "right",
      isMoney: true,
    },
    { key: "total", label: "Сумма", defaultWidth: "100px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "АКТ СПИСАНИЯ №{{number}}",
}

const REPAIR_RECEIPT_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Название магазина" },
    { key: "number", label: "Номер документа" },
    { key: "date", label: "Дата", isDate: true },
    { key: "createdByName", label: "Принял" },
    { key: "clientName", label: "Имя клиента" },
    { key: "clientPhone", label: "Телефон клиента" },
    { key: "deviceInfo", label: "Устройство" },
    { key: "deviceSerial", label: "Серийный номер" },
    { key: "deviceCondition", label: "Состояние устройства" },
    { key: "defectDescription", label: "Описание неисправности" },
    { key: "estimatedCost", label: "Предварительная стоимость", isMoney: true },
  ],
  tableColumns: [],
  hasTable: false,
  titleTemplate: "АКТ ПРИЁМКИ №{{number}}",
}

const REPAIR_DELIVERY_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Название магазина" },
    { key: "number", label: "Номер документа" },
    { key: "date", label: "Дата приёмки", isDate: true },
    { key: "completedDate", label: "Дата выполнения", isDate: true },
    { key: "clientName", label: "Имя клиента" },
    { key: "clientPhone", label: "Телефон клиента" },
    { key: "deviceInfo", label: "Устройство" },
    { key: "deviceSerial", label: "Серийный номер" },
    { key: "workDone", label: "Выполненные работы" },
    { key: "finalCost", label: "Итоговая стоимость", isMoney: true },
    { key: "totalPaid", label: "Оплачено", isMoney: true },
    { key: "remainingAmount", label: "К доплате", isMoney: true },
    { key: "warrantyDays", label: "Гарантия (дней)" },
    { key: "warrantyUntil", label: "Гарантия до", isDate: true },
  ],
  tableColumns: [],
  hasTable: false,
  titleTemplate: "АКТ ВЫДАЧИ №{{number}}",
}

const TRADE_IN_CONTRACT_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Название магазина" },
    { key: "storeAddress", label: "Адрес магазина" },
    { key: "storePhone", label: "Телефон магазина" },
    { key: "number", label: "Номер документа" },
    { key: "date", label: "Дата", isDate: true },
    { key: "sellerName", label: "Приёмщик" },
    { key: "clientName", label: "ФИО клиента" },
    { key: "clientPhone", label: "Телефон клиента" },
    { key: "clientPassportSeries", label: "Серия паспорта" },
    { key: "clientPassportNumber", label: "Номер паспорта" },
    { key: "clientPassportIssuedBy", label: "Паспорт выдан" },
    { key: "clientPassportIssuedAt", label: "Дата выдачи паспорта", isDate: true },
    { key: "deviceType", label: "Тип устройства" },
    { key: "deviceBrand", label: "Бренд" },
    { key: "deviceModel", label: "Модель" },
    { key: "deviceImei", label: "IMEI / Серийный номер" },
    { key: "deviceCondition", label: "Состояние" },
    { key: "agreedPrice", label: "Стоимость выкупа", isMoney: true },
    { key: "dealType", label: "Тип сделки" },
  ],
  tableColumns: [],
  hasTable: false,
  titleTemplate: "ДОГОВОР КУПЛИ-ПРОДАЖИ №{{number}}",
}

const RETURN_ACT_CONFIG: DocumentTypeConfig = {
  variables: [
    { key: "storeName", label: "Название магазина" },
    { key: "storeAddress", label: "Адрес магазина" },
    { key: "storePhone", label: "Телефон магазина" },
    { key: "returnNumber", label: "Номер возврата" },
    { key: "returnDate", label: "Дата возврата", isDate: true },
    { key: "saleNumber", label: "Номер продажи" },
    { key: "reason", label: "Причина возврата" },
    { key: "refundMethod", label: "Способ возврата" },
    { key: "totalAmount", label: "Сумма возврата", isMoney: true },
    { key: "sellerName", label: "Обработал" },
  ],
  tableColumns: [
    { key: "productName", label: "Наименование", defaultWidth: "auto", defaultAlign: "left" },
    { key: "quantity", label: "Кол-во", defaultWidth: "50px", defaultAlign: "center" },
    { key: "price", label: "Цена", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
    { key: "total", label: "Сумма", defaultWidth: "90px", defaultAlign: "right", isMoney: true },
  ],
  hasTable: true,
  titleTemplate: "АКТ ВОЗВРАТА №{{returnNumber}}",
}

export const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
  SALE_RECEIPT: SALE_RECEIPT_CONFIG,
  ORDER_FORM: ORDER_FORM_CONFIG,
  RECEIVE_DOC: RECEIVE_DOC_CONFIG,
  WRITE_OFF_DOC: WRITE_OFF_DOC_CONFIG,
  REPAIR_RECEIPT: REPAIR_RECEIPT_CONFIG,
  REPAIR_DELIVERY: REPAIR_DELIVERY_CONFIG,
  TRADE_IN_CONTRACT: TRADE_IN_CONTRACT_CONFIG,
  RETURN_ACT: RETURN_ACT_CONFIG,
}

// ---- Demo data for editor preview ----

export const DEMO_DATA: Record<
  DocumentType,
  { data: Record<string, unknown>; items: Record<string, unknown>[] }
> = {
  SALE_RECEIPT: {
    data: {
      storeName: "a:store Центральный",
      storeAddress: "ул. Ленина, 45, г. Москва",
      storePhone: "+7 (495) 123-45-67",
      number: "00123",
      date: "2026-03-14T10:00:00.000Z",
      sellerName: "Иванова Мария",
      totalAmount: 84970,
      discountAmount: 2000,
      finalAmount: 82970,
      paymentMethods: "Банковская карта",
    },
    items: [
      {
        productName: "iPhone 15 128GB Black",
        productSku: "APL-IP15-128-BLK",
        imei: "356789012345678",
        quantity: 1,
        price: 79990,
        discount: 2000,
        total: 77990,
      },
      {
        productName: "Чехол Apple iPhone 15 Clear Case",
        productSku: "APL-CC-IP15-CLR",
        imei: "",
        quantity: 1,
        price: 4980,
        discount: 0,
        total: 4980,
      },
    ],
  },

  ORDER_FORM: {
    data: {
      storeName: "a:store Центральный",
      number: "З-0045",
      date: "2026-03-14T10:00:00.000Z",
      sellerName: "Иванова Мария",
      clientName: "Алексей Петров",
      clientPhone: "+7 (916) 234-56-78",
      clientEmail: "a.petrov@mail.ru",
      totalAmount: 109990,
      prepaidAmount: 50000,
      remainingAmount: 59990,
      estimatedDays: 7,
    },
    items: [
      {
        name: "iPhone 15 Pro 256GB Natural Titanium",
        quantity: 1,
        price: 109990,
        total: 109990,
      },
    ],
  },

  RECEIVE_DOC: {
    data: {
      storeName: "a:store Центральный",
      supplierName: "ООО Техноимпорт",
      number: "П-00078",
      date: "2026-03-14T10:00:00.000Z",
      receivedByName: "Смирнов Дмитрий",
      totalAmount: 143920,
    },
    items: [
      {
        productName: "iPhone 15 128GB Black",
        quantity: 5,
        costPrice: 65000,
        total: 325000,
      },
      {
        productName: "Чехол Apple iPhone 15 Clear Case",
        quantity: 10,
        costPrice: 2490,
        total: 24900,
      },
    ],
  },

  WRITE_OFF_DOC: {
    data: {
      storeName: "a:store Центральный",
      number: "СП-00012",
      date: "2026-03-14T10:00:00.000Z",
      reason: "Брак",
      createdByName: "Козлов Андрей",
      totalAmount: 5980,
    },
    items: [
      {
        productName: 'Защитное стекло универсальное 6.1"',
        quantity: 2,
        costPrice: 490,
        total: 980,
      },
      {
        productName: "Кабель USB-C 1м (бракованный разъём)",
        quantity: 5,
        costPrice: 1000,
        total: 5000,
      },
    ],
  },

  REPAIR_RECEIPT: {
    data: {
      storeName: "a:store Сервис",
      number: "Р-00234",
      date: "2026-03-14T10:00:00.000Z",
      createdByName: "Сидоров Павел",
      clientName: "Сергей Иванов",
      clientPhone: "+7 (903) 345-67-89",
      deviceInfo: "Apple iPhone 14, 128GB, Purple",
      deviceSerial: "F2LXQ1ABCDEF",
      deviceCondition: "Трещина на экране, царапины на корпусе, Face ID работает",
      defectDescription: "Разбит дисплей, не реагирует на нажатия в правом нижнем углу",
      estimatedCost: 8500,
    },
    items: [],
  },

  REPAIR_DELIVERY: {
    data: {
      storeName: "a:store Сервис",
      number: "Р-00234",
      date: "2026-03-14T10:00:00.000Z",
      completedDate: "2026-03-17T14:00:00.000Z",
      clientName: "Сергей Иванов",
      clientPhone: "+7 (903) 345-67-89",
      deviceInfo: "Apple iPhone 14, 128GB, Purple",
      deviceSerial: "F2LXQ1ABCDEF",
      workDone: "Замена дисплейного модуля (оригинал). Проверка всех функций.",
      finalCost: 8500,
      totalPaid: 3000,
      remainingAmount: 5500,
      warrantyDays: 30,
      warrantyUntil: "2026-04-16T14:00:00.000Z",
    },
    items: [],
  },
  RETURN_ACT: {
    data: {
      storeName: "a:store Центральный",
      storeAddress: "ул. Ленина, 45, г. Москва",
      storePhone: "+7 (495) 123-45-67",
      returnNumber: "R-00045",
      returnDate: "2026-03-15T10:00:00.000Z",
      saleNumber: "00123",
      reason: "Брак товара",
      refundMethod: "Наличные",
      totalAmount: 4980,
      sellerName: "Иванова Мария",
    },
    items: [
      {
        productName: "Чехол Apple iPhone 15 Clear Case",
        quantity: 1,
        price: 4980,
        total: 4980,
      },
    ],
  },
  TRADE_IN_CONTRACT: {
    data: {
      storeName: "a:store Центральный",
      storeAddress: "ул. Ленина, 45, г. Москва",
      storePhone: "+7 (495) 123-45-67",
      number: "TI-2026-000001",
      date: "2026-03-15T10:00:00.000Z",
      sellerName: "Иванова Мария",
      clientName: "Петров Алексей Сергеевич",
      clientPhone: "+7 (916) 234-56-78",
      clientPassportSeries: "4510",
      clientPassportNumber: "123456",
      clientPassportIssuedBy: "ОВД Центрального района г. Москвы",
      clientPassportIssuedAt: "2015-05-20T00:00:00.000Z",
      deviceType: "Смартфон",
      deviceBrand: "Apple",
      deviceModel: "iPhone 14 128GB",
      deviceImei: "356789012345678",
      deviceCondition: "Хорошее. Мелкие царапины на корпусе, экран без повреждений.",
      agreedPrice: 35000,
      dealType: "Выкуп",
    },
    items: [],
  },
}

// ---- Payment method labels ----

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Банковская карта",
  SBP: "СБП",
  TRANSFER: "Перевод",
  CREDIT: "Рассрочка",
}
