/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/record'], function (search, record) {
  const afterSubmit = (context) => {
    try {
      if (context.type === context.UserEventType.TRANSFORM) {
        const orderId = context.newRecord.getValue({
          fieldId: 'otherrefnum',
        })
        let deposit = getDeposit(orderId)
        log.debug('deposit', deposit)
      }
    } catch (e) {
      log.debug('error', e.stack)
    }
  }

  const getDeposit = (orderId) => {
    let order = {}
    search
      .create({
        type: search.Type.TRANSACTION,
        filters: [
          {
            name: 'type',
            operator: search.Operator.ANYOF,
            values: ['Deposit'],
          },
          {
            name: 'memo',
            operator: search.Operator.CONTAINS,
            values: orderId,
          },
          {
            name: 'custbody3',
            operator: search.Operator.IS,
            values: orderId,
          },
        ],
        columns: [{ name: 'internalid' }, { name: 'account' }],
      })
      .run()
      .each((deposit) => {
        order.depositId = deposit.getValue({ name: 'internalid' })
        order.account = deposit.getValue({ name: 'account' })
        return true
      })

    return order
  }
  return {
    afterSubmit: afterSubmit,
  }
})
