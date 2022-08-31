/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
define(['N/search', 'N/record', 'N/runtime', 'N/task'], function (
  _search,
  _record,
  _runtime,
  _task,
) {
  function execute(context) {
    try {
      const pendingOrders = fetchOrdersInPendingBilling()

      // creates an new array of objects with unique objects
      const orders = [
        ...new Map(
          pendingOrders.map((order) => [order['id'], order]),
        ).values(),
      ]

      for (const [index, order] of orders.entries()) {
        if (_runtime.getCurrentScript().getRemainingUsage() > 1000) {
          log.debug('Order ID to be processed: ', order)
          const invoiceRecord = _record.transform({
            fromType: _record.Type.SALES_ORDER,
            fromId: order.id,
            toType: _record.Type.INVOICE,
            isDynamic: true,
          })
          invoiceRecord.setValue({
            fieldId: 'trandate',
            value: new Date(order.trandate),
          })
          invoiceRecord.save()
        }

        if (_runtime.getCurrentScript().getRemainingUsage() < 1000) {
          let rescheduledTask = _task.create({
            taskType: _task.TaskType.SCHEDULED_SCRIPT,
            scriptId: _runtime.getCurrentScript().id,
            deploymentId: _runtime.getCurrentScript().deploymentId,
          })

          let rescheduledTaskId = rescheduledTask.submit()
          let rescheduledTaskStatus = _task.checkStatus({ taskId: rescheduledTaskId})
          if (rescheduledTaskStatus === 'QUEUED')
            break
        }
      }
    } catch (e) {
      log.debug('Error processing orders', e.message)
      log.debug('Error processing orders', e.stack)
    }
  }

  const fetchOrdersInPendingBilling = () => {
    const pendingOrders = []
    try {
      _search
        .create({
          type: _search.Type.TRANSACTION,
          filters: [
            {
              name: 'type',
              operator: _search.Operator.ANYOF,
              values: ['SalesOrd'],
            },
            {
              name: 'status',
              operator: _search.Operator.ANYOF,
              values: ['SalesOrd:F'], // PENDING BILLING
            },
            {
              name: 'type',
              join: 'item',
              operator: _search.Operator.ANYOF,
              values: ['InvtPart', 'Group', 'Kit'],
            },
            {
              name: 'internalidnumber',
              join: 'billingtransaction',
              operator: _search.Operator.ISEMPTY,
              values: [],
            },
            {
              name: 'number',
              operator: _search.Operator.NOTEQUALTO,
              values: ['398'],
            },
          ],
          columns: [
            {
              name: 'internalid',
            },
            {
              name: 'trandate',
              join: 'fulfillingTransaction',
            },
          ],
        })
        .run()
        .each((result) => {
          const order = {
            id: result.id,
            trandate: result.getValue({
              name: 'trandate',
              join: 'fulfillingTransaction',
            }),
          }
          pendingOrders.push(order)
          return true
        })
    } catch (e) {
      log.debug('Error fetching pending orders', e.message)
    }

    return pendingOrders
  }
  return {
    execute: execute,
  }
})
