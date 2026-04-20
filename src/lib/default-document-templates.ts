import type { DocumentLayout, DocumentType } from "@/lib/validations/document-templates"

// ---- SALE_RECEIPT ----

const saleReceiptLayout: DocumentLayout = {
  blocks: [
    {
      id: "sr-1",
      type: "heading",
      content: "{{storeName}}",
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "sr-2",
      type: "text",
      content: "{{storeAddress}}",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "center",
      showIf: { field: "storeAddress", op: "exists" },
    },
    {
      id: "sr-3",
      type: "text",
      content: "Тел: {{storePhone}}",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "center",
      showIf: { field: "storePhone", op: "exists" },
    },
    {
      id: "sr-4",
      type: "heading",
      content: "ТОВАРНЫЙ ЧЕК №{{number}}",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "sr-5",
      type: "keyValue",
      items: [
        { label: "Дата", value: "{{date}}" },
        { label: "Продавец", value: "{{sellerName}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "sr-6",
      type: "table",
      columns: [
        { key: "productName", header: "Наименование", width: "auto", align: "left" },
        { key: "quantity", header: "Кол-во", width: "50px", align: "center" },
        { key: "price", header: "Цена", width: "90px", align: "right" },
        { key: "discount", header: "Скидка", width: "80px", align: "right" },
        { key: "total", header: "Сумма", width: "90px", align: "right" },
      ],
      showRowNumbers: true,
      showTotal: false,
      totalLabel: "Итого",
      fontSize: 11,
    },
    {
      id: "sr-7",
      type: "keyValue",
      items: [
        { label: "Итого", value: "{{totalAmount}}" },
        {
          label: "Скидка",
          value: "{{discountAmount}}",
          showIf: { field: "discountAmount", op: "gt", value: 0 },
        },
        { label: "К ОПЛАТЕ", value: "{{finalAmount}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "sr-8",
      type: "text",
      content: "{{paymentMethods}}",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "sr-9",
      type: "text",
      content: "Спасибо за покупку!",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "center",
    },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}

// ---- ORDER_FORM ----

const orderFormLayout: DocumentLayout = {
  blocks: [
    {
      id: "of-1",
      type: "heading",
      content: "{{storeName}}",
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "of-2",
      type: "heading",
      content: "БЛАНК ЗАКАЗА №{{number}}",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "of-3",
      type: "keyValue",
      items: [
        { label: "Дата", value: "{{date}}" },
        { label: "Продавец", value: "{{sellerName}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "of-4",
      type: "heading",
      content: "Клиент:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "of-5",
      type: "keyValue",
      items: [
        { label: "ФИО", value: "{{clientName}}" },
        { label: "Телефон", value: "{{clientPhone}}" },
        {
          label: "E-mail",
          value: "{{clientEmail}}",
          showIf: { field: "clientEmail", op: "exists" },
        },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "of-6",
      type: "table",
      columns: [
        { key: "productName", header: "Наименование", width: "auto", align: "left" },
        { key: "quantity", header: "Кол-во", width: "50px", align: "center" },
        { key: "price", header: "Цена", width: "90px", align: "right" },
        { key: "total", header: "Сумма", width: "90px", align: "right" },
      ],
      showRowNumbers: true,
      showTotal: false,
      totalLabel: "Итого",
      fontSize: 11,
    },
    {
      id: "of-7",
      type: "keyValue",
      items: [
        { label: "Итого", value: "{{totalAmount}}" },
        { label: "Предоплата", value: "{{prepaidAmount}}" },
        {
          label: "Остаток к оплате",
          value: "{{remainingAmount}}",
          showIf: { field: "remainingAmount", op: "gt", value: 0 },
        },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "of-8",
      type: "text",
      content: "Ориентировочный срок: {{estimatedDays}} дн.",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "left",
      showIf: { field: "estimatedDays", op: "exists" },
    },
    {
      id: "of-9",
      type: "signatures",
      items: [
        { label: "Продавец", name: "{{sellerName}}" },
        { label: "Клиент", name: "" },
      ],
      showDate: false,
    },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}

// ---- RECEIVE_DOC ----

const receiveDocLayout: DocumentLayout = {
  blocks: [
    {
      id: "rd-1",
      type: "heading",
      content: "ПРИХОДНАЯ НАКЛАДНАЯ №{{number}}",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "rd-2",
      type: "keyValue",
      items: [
        { label: "Дата", value: "{{date}}" },
        { label: "Магазин", value: "{{storeName}}" },
        {
          label: "Поставщик",
          value: "{{supplierName}}",
          showIf: { field: "supplierName", op: "exists" },
        },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "rd-3",
      type: "table",
      columns: [
        { key: "productName", header: "Наименование", width: "auto", align: "left" },
        { key: "quantity", header: "Кол-во", width: "50px", align: "center" },
        { key: "costPrice", header: "Себестоимость", width: "100px", align: "right" },
        { key: "total", header: "Сумма", width: "100px", align: "right" },
      ],
      showRowNumbers: true,
      showTotal: true,
      totalLabel: "Итого:",
      fontSize: 11,
    },
    {
      id: "rd-4",
      type: "signatures",
      items: [
        { label: "Принял", name: "{{receivedByName}}" },
        { label: "Сдал", name: "" },
      ],
      showDate: false,
    },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}

// ---- WRITE_OFF_DOC ----

const writeOffDocLayout: DocumentLayout = {
  blocks: [
    {
      id: "wd-1",
      type: "heading",
      content: "АКТ СПИСАНИЯ №{{number}}",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "wd-2",
      type: "keyValue",
      items: [
        { label: "Дата", value: "{{date}}" },
        { label: "Магазин", value: "{{storeName}}" },
        { label: "Причина", value: "{{reason}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "wd-3",
      type: "table",
      columns: [
        { key: "productName", header: "Наименование", width: "auto", align: "left" },
        { key: "quantity", header: "Кол-во", width: "50px", align: "center" },
        { key: "costPrice", header: "Себестоимость", width: "100px", align: "right" },
        { key: "total", header: "Сумма", width: "100px", align: "right" },
      ],
      showRowNumbers: true,
      showTotal: true,
      totalLabel: "Итого:",
      fontSize: 11,
    },
    {
      id: "wd-4",
      type: "signatures",
      items: [
        { label: "Составил", name: "{{createdByName}}" },
        { label: "Утвердил", name: "" },
      ],
      showDate: false,
    },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}

// ---- REPAIR_RECEIPT ----

const repairReceiptLayout: DocumentLayout = {
  blocks: [
    {
      id: "rr-1",
      type: "heading",
      content: "{{storeName}}",
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "rr-2",
      type: "heading",
      content: "АКТ ПРИЁМКИ В РЕМОНТ №{{number}}",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "rr-3",
      type: "keyValue",
      items: [
        { label: "Дата", value: "{{date}}" },
        { label: "Приёмщик", value: "{{createdByName}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "rr-4",
      type: "heading",
      content: "Клиент:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "rr-5",
      type: "keyValue",
      items: [
        { label: "ФИО", value: "{{clientName}}" },
        { label: "Телефон", value: "{{clientPhone}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "rr-6",
      type: "heading",
      content: "Устройство:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "rr-7",
      type: "keyValue",
      items: [
        { label: "Устройство", value: "{{deviceInfo}}" },
        {
          label: "Серийный номер / IMEI",
          value: "{{deviceSerial}}",
          showIf: { field: "deviceSerial", op: "exists" },
        },
        { label: "Состояние", value: "{{deviceCondition}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "rr-8",
      type: "heading",
      content: "Описание неисправности:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "rr-9",
      type: "text",
      content: "{{defectDescription}}",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "left",
    },
    {
      id: "rr-10",
      type: "keyValue",
      items: [
        {
          label: "Оценка стоимости",
          value: "{{estimatedCost}}",
          showIf: { field: "estimatedCost", op: "exists" },
        },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    { id: "rr-11", type: "divider", style: "solid", margin: 8 },
    {
      id: "rr-12",
      type: "text",
      content:
        "Подписывая данный акт, клиент подтверждает, что устройство принято в указанном состоянии. Организация не несёт ответственности за данные, хранящиеся на устройстве. Оценка стоимости является предварительной и может быть уточнена после диагностики.",
      fontSize: 10,
      fontWeight: "normal",
      textAlign: "left",
    },
    {
      id: "rr-13",
      type: "signatures",
      items: [
        { label: "Приёмщик", name: "{{createdByName}}" },
        { label: "Клиент", name: "" },
      ],
      showDate: false,
    },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}

// ---- REPAIR_DELIVERY ----

const repairDeliveryLayout: DocumentLayout = {
  blocks: [
    {
      id: "rdl-1",
      type: "heading",
      content: "{{storeName}}",
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "rdl-2",
      type: "heading",
      content: "АКТ ВЫДАЧИ №{{number}}",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "rdl-3",
      type: "keyValue",
      items: [
        { label: "Дата приёмки", value: "{{date}}" },
        {
          label: "Дата выполнения",
          value: "{{completedDate}}",
          showIf: { field: "completedDate", op: "exists" },
        },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "rdl-4",
      type: "heading",
      content: "Клиент:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "rdl-5",
      type: "keyValue",
      items: [
        { label: "ФИО", value: "{{clientName}}" },
        { label: "Телефон", value: "{{clientPhone}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "rdl-6",
      type: "heading",
      content: "Устройство:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "rdl-7",
      type: "keyValue",
      items: [
        { label: "Устройство", value: "{{deviceInfo}}" },
        {
          label: "Серийный номер / IMEI",
          value: "{{deviceSerial}}",
          showIf: { field: "deviceSerial", op: "exists" },
        },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "rdl-8",
      type: "text",
      content: "Выполненные работы: {{workDone}}",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "left",
      showIf: { field: "workDone", op: "exists" },
    },
    {
      id: "rdl-9",
      type: "heading",
      content: "Стоимость:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "rdl-10",
      type: "keyValue",
      items: [
        { label: "Итого", value: "{{finalCost}}", showIf: { field: "finalCost", op: "exists" } },
        { label: "Оплачено", value: "{{totalPaid}}" },
        {
          label: "К доплате",
          value: "{{remainingAmount}}",
          showIf: { field: "remainingAmount", op: "gt", value: 0 },
        },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "rdl-11",
      type: "panel",
      border: true,
      padding: 8,
      showIf: { field: "warrantyDays", op: "exists" },
      children: [
        {
          id: "rdl-11-1",
          type: "heading",
          content: "ГАРАНТИЙНЫЙ ТАЛОН",
          fontSize: 14,
          fontWeight: "bold",
          textAlign: "center",
        },
        {
          id: "rdl-11-2",
          type: "keyValue",
          items: [
            { label: "Устройство", value: "{{deviceInfo}}" },
            {
              label: "Серийный номер / IMEI",
              value: "{{deviceSerial}}",
              showIf: { field: "deviceSerial", op: "exists" },
            },
            { label: "Срок гарантии", value: "{{warrantyDays}} дн." },
            {
              label: "Гарантия до",
              value: "{{warrantyUntil}}",
              showIf: { field: "warrantyUntil", op: "exists" },
            },
          ],
          fontSize: 12,
          layout: "stacked",
        },
        {
          id: "rdl-11-3",
          type: "text",
          content:
            "Гарантия не распространяется на механические повреждения, попадание жидкости и нарушение правил эксплуатации.",
          fontSize: 10,
          fontWeight: "normal",
          textAlign: "left",
        },
      ],
    },
    {
      id: "rdl-12",
      type: "signatures",
      items: [
        { label: "Выдал", name: "" },
        { label: "Клиент", name: "" },
      ],
      showDate: false,
    },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}

// ---- TRADE_IN_CONTRACT ----

const tradeInContractLayout: DocumentLayout = {
  blocks: [
    {
      id: "ti-1",
      type: "heading",
      content: "{{storeName}}",
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "ti-2",
      type: "text",
      content: "{{storeAddress}}",
      fontSize: 10,
      fontWeight: "normal",
      textAlign: "center",
      showIf: { field: "storeAddress", op: "exists" },
    },
    {
      id: "ti-3",
      type: "text",
      content: "Тел: {{storePhone}}",
      fontSize: 10,
      fontWeight: "normal",
      textAlign: "center",
      showIf: { field: "storePhone", op: "exists" },
    },
    {
      id: "ti-4",
      type: "heading",
      content: "ДОГОВОР КУПЛИ-ПРОДАЖИ №{{number}}",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "ti-5",
      type: "text",
      content: "от {{date}}",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "center",
    },
    { id: "ti-6", type: "divider", style: "solid", margin: 8 },
    {
      id: "ti-7",
      type: "heading",
      content: "Продавец (клиент):",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "ti-8",
      type: "keyValue",
      items: [
        { label: "ФИО", value: "{{clientName}}" },
        { label: "Телефон", value: "{{clientPhone}}" },
        { label: "Паспорт", value: "{{clientPassportSeries}} {{clientPassportNumber}}" },
        {
          label: "Выдан",
          value: "{{clientPassportIssuedBy}}",
          showIf: { field: "clientPassportIssuedBy", op: "exists" },
        },
        {
          label: "Дата выдачи",
          value: "{{clientPassportIssuedAt}}",
          showIf: { field: "clientPassportIssuedAt", op: "exists" },
        },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "ti-9",
      type: "heading",
      content: "Предмет сделки:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "ti-10",
      type: "keyValue",
      items: [
        { label: "Тип", value: "{{deviceType}}" },
        {
          label: "Бренд",
          value: "{{deviceBrand}}",
          showIf: { field: "deviceBrand", op: "exists" },
        },
        {
          label: "Модель",
          value: "{{deviceModel}}",
          showIf: { field: "deviceModel", op: "exists" },
        },
        {
          label: "IMEI / Серийный номер",
          value: "{{deviceImei}}",
          showIf: { field: "deviceImei", op: "exists" },
        },
        { label: "Состояние", value: "{{deviceCondition}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    { id: "ti-11", type: "divider", style: "dashed", margin: 8 },
    {
      id: "ti-12",
      type: "keyValue",
      items: [
        { label: "Тип сделки", value: "{{dealType}}" },
        { label: "Стоимость", value: "{{agreedPrice}}" },
      ],
      fontSize: 14,
      layout: "stacked",
    },
    { id: "ti-13", type: "divider", style: "solid", margin: 8 },
    {
      id: "ti-14",
      type: "text",
      content:
        "Продавец подтверждает, что является законным владельцем указанного устройства, устройство не находится в розыске, залоге или под арестом. Покупатель принимает устройство в указанном состоянии. Стороны претензий друг к другу не имеют.",
      fontSize: 10,
      fontWeight: "normal",
      textAlign: "left",
    },
    {
      id: "ti-15",
      type: "signatures",
      items: [
        { label: "Покупатель (магазин)", name: "{{sellerName}}" },
        { label: "Продавец (клиент)", name: "" },
      ],
      showDate: false,
    },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}

// ---- RETURN_ACT ----

const returnActLayout: DocumentLayout = {
  blocks: [
    {
      id: "ra-1",
      type: "heading",
      content: "{{storeName}}",
      fontSize: 16,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "ra-2",
      type: "text",
      content: "{{storeAddress}}",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "center",
      showIf: { field: "storeAddress", op: "exists" },
    },
    {
      id: "ra-3",
      type: "text",
      content: "Тел: {{storePhone}}",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "center",
      showIf: { field: "storePhone", op: "exists" },
    },
    {
      id: "ra-4",
      type: "heading",
      content: "АКТ ВОЗВРАТА №{{returnNumber}}",
      fontSize: 14,
      fontWeight: "bold",
      textAlign: "center",
    },
    {
      id: "ra-5",
      type: "keyValue",
      items: [
        { label: "Дата возврата", value: "{{returnDate}}" },
        { label: "Номер продажи", value: "{{saleNumber}}" },
        { label: "Обработал", value: "{{sellerName}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "ra-6",
      type: "heading",
      content: "Причина возврата:",
      fontSize: 12,
      fontWeight: "bold",
      textAlign: "left",
    },
    {
      id: "ra-7",
      type: "text",
      content: "{{reason}}",
      fontSize: 12,
      fontWeight: "normal",
      textAlign: "left",
    },
    {
      id: "ra-8",
      type: "table",
      columns: [
        { key: "productName", header: "Наименование", width: "auto", align: "left" },
        { key: "quantity", header: "Кол-во", width: "50px", align: "center" },
        { key: "price", header: "Цена", width: "90px", align: "right" },
        { key: "total", header: "Сумма", width: "90px", align: "right" },
      ],
      showRowNumbers: true,
      showTotal: true,
      totalLabel: "Итого:",
      fontSize: 11,
    },
    {
      id: "ra-9",
      type: "keyValue",
      items: [
        { label: "Сумма возврата", value: "{{totalAmount}}" },
        { label: "Способ возврата", value: "{{refundMethod}}" },
      ],
      fontSize: 12,
      layout: "stacked",
    },
    {
      id: "ra-10",
      type: "signatures",
      items: [
        { label: "Продавец", name: "{{sellerName}}" },
        { label: "Покупатель", name: "" },
      ],
      showDate: false,
    },
  ],
  pageMargin: 10,
  fontFamily: "serif",
}

// ---- Export ----

export function getDefaultLayouts(): Record<DocumentType, DocumentLayout> {
  return {
    SALE_RECEIPT: saleReceiptLayout,
    ORDER_FORM: orderFormLayout,
    RECEIVE_DOC: receiveDocLayout,
    WRITE_OFF_DOC: writeOffDocLayout,
    REPAIR_RECEIPT: repairReceiptLayout,
    REPAIR_DELIVERY: repairDeliveryLayout,
    TRADE_IN_CONTRACT: tradeInContractLayout,
    RETURN_ACT: returnActLayout,
  }
}
