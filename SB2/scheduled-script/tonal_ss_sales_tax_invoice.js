/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
define(['N/record', 'N/search'], function (record, search) {
  function execute(context) {}

  const getOrders = () => {
    const salesOrders = []
    try {
      search
        .create({
          type: search.Type.TRANSACTION,
          filters: [
            {
              name: 'type',
              operator: search.Operator.ANYOF,
              values: ['SalesOrd'],
            },
            {
              name: 'status',
              operator: search.Operator.ANYOF,
              values: ['SalesOrd:F'],
            },
            {
              name: 'type',
              join: 'item',
              operator: _search.Operator.ANYOF,
              values: ['InvtPart', 'Group', 'Kit', 'OthCharge'],
            },
            {
              name: 'internalidnumber',
              join: 'billingtransaction',
              operator: _search.Operator.ISEMPTY,
              values: [],
            },
          ],
          columns: [{ name: 'internalid' }],
        })
        .run()
        .each((record) => {
          salesOrders.push({ id: record.id })
        })
    } catch (e) {}
  }

  return {
    execute: execute,
  }
})
