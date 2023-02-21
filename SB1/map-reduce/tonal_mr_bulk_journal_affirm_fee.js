/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record'], function (search, record) {
  const getInputData = () => {
    const results = []
    search
      .create({
        type: search.Type.TRANSACTION,
        filters: [
          {
            name: 'type',
            operator: search.Operator.ANYOF,
            values: ['CustDep'],
          },
          {
            name: 'paymentmethod',
            operator: search.Operator.ANYOF,
            values: [7],
          },
          {
            name: 'custbody_payment_fee',
            operator: search.Operator.ISNOTEMPTY,
            values: [],
          },
          {
            name: 'custbody_journal_entry_status',
            operator: search.Operator.NONEOF,
            values: [3],
          },
          {
            name: 'datecreated',
            join: 'createdfrom',
            operator: search.Operator.ONORAFTER,
            values: ['11/01/2022 12:00 am'],
          },
        ],
        columns: [
          { name: 'salesorder' },
          { name: 'custbody_payment_fee' },
          { name: 'memo' },
          { name: 'internalid' },
          { name: 'statusref', join: 'salesOrder' },
          { name: 'custbody_merchant_fee_je_1' },
          { name: 'custbody_merchant_fee_je_2' },
        ],
      })
      .run()
      .each((order) => {
        let isAccrued = false
        let isOffset = false

        let orderStatus = order.getValue({
          name: 'statusref',
          join: 'salesOrder',
        })

        let accruedJe = order.getValue({
          name: 'custbody_merchant_fee_je_1',
        })

        let offsetJe = order.getValue({
          name: 'custbody_merchant_fee_je_2',
        })

        if (
          accruedJe === '' &&
          (orderStatus === 'pendingFulfillment' ||
            orderStatus === 'pendingBilling' ||
            orderStatus === 'fullyBilled')
        ) {
          isAccrued = false
        }

        if (
          accruedJe !== '' &&
          (orderStatus === 'pendingFulfillment' ||
            orderStatus === 'fullyBilled' ||
            orderStatus === 'pendingBilling')
        )
          isAccrued = true

        if (
          offsetJe !== '' &&
          (orderStatus === 'fullyBilled' ||
            orderStatus === 'pendingBilling')
        )
          isOffset = true

        if (
          offsetJe === '' &&
          (orderStatus === 'fullyBilled' ||
            orderStatus === 'pendingBilling')
        )
          isOffset = false

        let record = {
          depositId: order.getValue({ name: 'internalid' }),
          salesOrderId: order.getValue({ name: 'salesorder' }),
          salesOrderStatus: order.getValue({
            name: 'statusref',
            join: 'salesOrder',
          }),
          woocommerceOrderId: order.getValue({ name: 'memo' }),
          feeAmount: order.getValue({ name: 'custbody_payment_fee' }),
          isAccrued: isAccrued,
          isOffset: isOffset,
        }
        results.push(record)
        return true
      })

    return results
  }

  const map = (context) => {
    let input = JSON.parse(context.value)

    if (input.isAccrued === true && input.isOffset === true)
      context.write({
        key: 'processed',
        value: input,
      })

    if (
      (input.isAccrued === true && input.isOffset === false) ||
      (input.isAccrued === false && input.isOffset === true)
    )
      context.write({
        key: 'oneJournal',
        value: input,
      })

    if (input.isAccrued === false && input.isOffset === false)
      context.write({
        key: 'twoJournals',
        value: input,
      })
  }

  const reduce = (context) => {
    log.debug(context.key, context.values)
    let records = context.values
    records.forEach((rec) => {
      switch (context.key) {
        case 'processed':
          updateCustomerDeposit(rec)
          break
        case 'oneJournal':
          processOneJournal(rec)
          break
        case 'twoJournals':
          processTwoJournals(rec)
          break
      }
    })
  }

  const summarize = (summary) => {}

  const updateCustomerDeposit = (deposit) => {
    if (typeof deposit !== 'object') {
      let depositObj = JSON.parse(deposit)
      if (
        depositObj.isAccrued === true &&
        depositObj.isOffset === true
      ) {
        //Customer Deposit
        let custDeposit = record.load({
          type: record.Type.CUSTOMER_DEPOSIT,
          id: depositObj.depositId,
        })

        custDeposit.setValue({
          fieldId: 'custbody_journal_entry_status',
          value: 3,
        })
        custDeposit.save()
      }
    }
  }

  const processOneJournal = (deposit) => {
    if (typeof deposit !== 'object') {
      let depositObj = JSON.parse(deposit)
      if (
        depositObj.salesOrderStatus === 'pendingFulfillment' &&
        depositObj.isAccrued === false
      ) {
        let customerDeposit = record.load({
          type: record.Type.CUSTOMER_DEPOSIT,
          id: depositObj.depositId,
        })
        customerDeposit.setValue({
          fieldId: 'custbody_journal_entry_status',
          value: 1,
        })
        customerDeposit.save()
      }

      if (
        (depositObj.salesOrderStatus === 'pendingBilling' ||
          depositObj.salesOrderStatus === 'fullyBilled') &&
        depositObj.isOffset === false
      ) {
        let fulfillmentObj = getItemFulfillment(
          depositObj.salesOrderId,
        )
        let itemFulfillment = record.load({
          type: record.Type.ITEM_FULFILLMENT,
          id: fulfillmentObj.fulfillId,
        })
        itemFulfillment.save()
      }
    }
  }

  const processTwoJournals = (deposit) => {
    if (typeof deposit !== 'object') {
      let depositObj = JSON.parse(deposit)

      if (depositObj.salesOrderStatus === 'pendingFulfillment') {
        let customerDeposit = record.load({
          type: record.Type.CUSTOMER_DEPOSIT,
          id: depositObj.depositId,
        })
        customerDeposit.save()
      }

      if (
        depositObj.salesOrderStatus === 'fullyBilled' ||
        depositObj.salesOrderStatus === 'pendingBilling'
      ) {
        let fulfillment = getItemFulfillment(depositObj.salesOrderId)
        let customerDeposit = record.load({
          type: record.Type.CUSTOMER_DEPOSIT,
          id: depositObj.depositId,
        })

        customerDeposit.setValue({
          fieldId: 'custbody_journal_entry_status',
          value: 3,
        })
        customerDeposit.save()

        let itemFulfillment = record.load({
          type: record.Type.ITEM_FULFILLMENT,
          id: fulfillment.fulfillId,
        })
        itemFulfillment.save()
      }
    }
    // log.debug('processing two journals', deposit)
  }

  const getItemFulfillment = (salesOrderId) => {
    let fulfillment = {}
    search
      .create({
        type: search.Type.TRANSACTION,
        filters: [
          {
            name: 'type',
            operator: search.Operator.ANYOF,
            values: ['ItemShip'],
          },
          {
            name: 'createdfrom',
            operator: search.Operator.ANYOF,
            values: [salesOrderId],
          },
          {
            name: 'mainline',
            operator: search.Operator.IS,
            values: true,
          },
        ],
        columns: [{ name: 'internalid' }, { name: 'createdfrom' }],
      })
      .run()
      .each((itemfulfillment) => {
        fulfillment.fulfillId = itemfulfillment.getValue({
          name: 'internalid',
        })
        return true
      })

    return fulfillment
  }

  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize,
  }
})
