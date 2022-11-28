/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */
define(['N/record', 'N/search'], function (record, search) {
  const _post = (context) => {
    log.debug('REQUEST', context)
    const data = extractData(context)
    const output = createCustomerDeposit(data)

    log.debug('RESPONSE', output)
    return JSON.stringify(output)
  }

  const createCustomerDeposit = (data) => {
    log.debug('data', data)
    let salesOrderFields = getSalesOrderFields(data.salesOrderId)

    const customerDeposit = record.create({
      type: record.Type.CUSTOMER_DEPOSIT,
      isDynamic: true,
    })
    customerDeposit.setValue({
      fieldId: 'customer',
      value: data.customerId,
    })
    customerDeposit.setValue({
      fieldId: 'payment',
      value: data.paymentTotal,
    })
    customerDeposit.setValue({
      fieldId: 'currency',
      value: data.currency[0].id,
    })
    customerDeposit.setValue({
      fieldId: 'trandate',
      value: new Date(data.tranDate),
    })
    customerDeposit.setValue({
      fieldId: 'salesorder',
      value: data.salesOrderId,
    })
    customerDeposit.setValue({
      fieldId: 'paymentmethod',
      value: data.paymentDetails[0].details.method,
    })
    customerDeposit.setValue({
      fieldId: 'custbody_payment_fee',
      value: data.paymentFee,
    })
    customerDeposit.setValue({
      fieldId: 'custbody3',
      value: data.woocommerceNumber,
    })
    customerDeposit.setValue({
      fieldId: 'memo',
      value: data.woocommerceNumber,
    })
    customerDeposit.setValue({
      fieldId: 'custbody_payment_event_id',
      value: data.eventId,
    })
    customerDeposit.setValue({
      fieldId: 'custbody_payment_event_type',
      value: data.eventType,
    })
    customerDeposit.setValue({
      fieldId: 'custbody_payment_net_total',
      value: data.netTotal,
    })
    customerDeposit.setValue({
      fieldId: 'custbody_payment_tax',
      value: data.tax,
    })
    customerDeposit.setValue({
      fieldId: 'custbody_payment_woocommerce_tran_id',
      value: data.chargeId,
    })
    customerDeposit.setValue({
      fieldId: 'custbody_payment_charge_ref',
      value: data.chargeRef,
    })
    customerDeposit.setValue({
      fieldId: 'custbody_payment_order_key',
      value: data.orderKey,
    })

    if (salesOrderFields.location.length > 0) {
      customerDeposit.setValue({
        fieldId: 'location',
        value: salesOrderFields.location[0].value,
      })
    }

    if (salesOrderFields.department.length > 0) {
      customerDeposit.setValue({
        fieldId: 'department',
        value: salesOrderFields.department[0].value,
      })
    }
    customerDeposit.save()
    data.customerDepositId = customerDeposit.id
    if (customerDeposit.id) {
      record.submitFields({
        type: record.Type.SALES_ORDER,
        id: data.salesOrderId,
        values: {
          custbody_payment_received: true,
        },
      })
    }

    return data
  }

  const extractData = (data) => {
    const validData = {}

    for (const [key, value] of Object.entries(data)) {
      if (key === 'payment_method')
        validData.paymentDetails = tonalCOA(value)
      if (key === 'payment_fee') validData.paymentFee = value
      if (key === 'payment_total') validData.paymentTotal = value
      if (key === 'total_tax') validData.tax = value
      if (key === 'payment_currency')
        validData.currency = currencyMap(value)
      if (key === 'woocommerce_transaction_id')
        validData.chargeId = value
      if (key === 'netsuite_sales_order_id')
        validData.salesOrderId = value
      if (key === 'netsuite_customer_id') validData.customerId = value
      if (key === 'net_settlement') validData.netTotal = value
      if (key === 'transaction_date') validData.tranDate = value
      if (key === 'charge_reference') validData.chargeRef = value
      if (key === 'woocommerce_order_key') validData.orderKey = value
      if (key === 'woocommerce_number')
        validData.woocommerceNumber = value
      if (key === 'event_id') validData.eventId = value
      if (key === 'event_type') validData.eventType = value
    }
    return validData
  }

  const currencyMap = (inputCurrency) => {
    const currencies = [
      { currency: 'USD', id: 1 },
      { currency: 'GBP', id: 2 },
      { currency: 'CAD', id: 3 },
      { currency: 'EUR', id: 4 },
      { currency: 'TWD', id: 5 },
      { currency: 'CNY', id: 6 },
      { currency: 'VND', id: 7 },
      { currency: 'GTQ', id: 8 },
      { currency: 'HKD', id: 9 },
      { currency: 'JPY', id: 10 },
      { currency: 'MYR', id: 11 },
      { currency: 'CHF', id: 12 },
      { currency: 'MXN', id: 13 },
    ]
    return currencies.filter(
      (currency) => currency.currency === inputCurrency,
    )
  }

  const tonalCOA = (paymentMethod) => {
    const accounts = [
      {
        type: 'Affirm',
        details: { method: '7', account: '645' },
      },
      {
        type: 'Stripe',
        details: { method: '8', account: '632' },
      },
      {
        type: 'Klarna',
        details: { method: '11', account: '1108' },
      },
    ]

    return accounts.filter(
      (account) => account.type === paymentMethod,
    )
  }

  const getSalesOrderFields = (salesOrderId) => {
    let salesOrderFields = search.lookupFields({
      type: search.Type.SALES_ORDER,
      id: salesOrderId,
      columns: ['location', 'department', 'subsidiary'],
    })

    return salesOrderFields
  }
  return {
    post: _post,
  }
})
