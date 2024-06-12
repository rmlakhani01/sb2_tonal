/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
/**
 * Update History
 * Version            By            Date          Request By              Description
 * V1                 Vikash        07/12/2023    Ali                     Modification for the include the Extend Skus containing Sales Order for auto invoiceing
 * V2                 Rehan         11/12/2023    Joanna                  Fixing the code to handle the different order types - Service and Hardware.
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
      // const pendingOrders = manualRun()
      log.debug('pending orders', pendingOrders)

      const uniqueOrders = [
        ...new Map(
          pendingOrders
            .filter((order) => order.id && order.trandate)
            .sort((a, b) => {
              // First, sort by 'id' in ascending order
              const idComparison = a.id.localeCompare(b.id)
              if (idComparison !== 0) {
                return idComparison
              }

              // If 'id' is the same, then sort by 'fulfillDate' in ascending order
              return a.fulfillDate.localeCompare(b.fulfillDate)
            })
            .map((order) => [order['id'], order]),
        ).values(),
      ]

      log.debug('unique Orders', uniqueOrders)

      for (const [index, order] of uniqueOrders.entries()) {
        try {
          log.debug('Order ID to be processed: ', order)
          const invoiceRecord = _record.transform({
            fromType: _record.Type.SALES_ORDER,
            fromId: order.id,
            toType: _record.Type.INVOICE,
            isDynamic: true,
          })

          if (order.trandate && order.fulfillDate === '') {
            invoiceRecord.setValue({
              fieldId: 'trandate',
              value: new Date(order.trandate),
            })
          } else if (order.trandate && order.fulfillDate !== '') {
            invoiceRecord.setValue({
              fieldId: 'trandate',
              value: new Date(order.fulfillDate),
            })
          }
          let invoiceId = invoiceRecord.save()
          if (invoiceId) {
            log.debug(
              'Invoice Created For Sales Order =>' + order.id,
              'Invoice Id =>' + invoiceId,
            )
          }

          if (
            _runtime.getCurrentScript().getRemainingUsage() < 1000
          ) {
            let rescheduledTask = _task.create({
              taskType: _task.TaskType.SCHEDULED_SCRIPT,
              scriptId: _runtime.getCurrentScript().id,
              deploymentId: _runtime.getCurrentScript().deploymentId,
            })

            let rescheduledTaskId = rescheduledTask.submit()
            let rescheduledTaskStatus = _task.checkStatus({
              taskId: rescheduledTaskId,
            })
            if (rescheduledTaskStatus === 'QUEUED') break
          }
        } catch (err) {
          populateErrors(err, order)
          log.debug('Error processing orders', err.message)
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
              name: 'internalidnumber',
              operator: _search.Operator.NOTEQUALTO,
              values: ['11644383'],
            },
            {
              name: 'internalidnumber',
              operator: _search.Operator.NOTEQUALTO,
              values: ['12279252'],
            },
            {
              name: 'internalidnumber',
              operator: _search.Operator.NOTEQUALTO,
              values: ['11869021'],
            },
            {
              name: 'internalidnumber',
              operator: _search.Operator.NOTEQUALTO,
              values: ['11902020'],
            },
            {
              name: 'internalidnumber',
              operator: _search.Operator.NOTEQUALTO,
              values: ['12441871'],
            },
            {
              name: 'internalidnumber',
              operator: _search.Operator.NOTEQUALTO,
              values: ['12589819'],
            },
            {
              name: 'type',
              join: 'item',
              operator: _search.Operator.ANYOF,
              values: [
                'InvtPart',
                'Group',
                'Kit',
                'Service',
                'Assembly',
              ],
            },
            // {
            //   name: 'internalidnumber',
            //   join: 'billingtransaction',
            //   operator: _search.Operator.ISEMPTY,
            //   values: [],
            // },
            {
              name: 'number',
              operator: _search.Operator.NOTEQUALTO,
              values: ['398'],
            },
            {
              name: 'datecreated',
              operator: _search.Operator.ONORAFTER,
              values: ['10/01/2023 12:00 am'],
            },
          ],
          columns: [
            { name: 'internalid' },
            { name: 'trandate' },
            { name: 'trandate', join: 'fulfillingTransaction' },
          ],
        })
        .run()
        .each((result) => {
          const order = {
            id: result.id,
            trandate: result.getValue({ name: 'trandate' }),
            fulfillDate: result.getValue({
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

  const getFulfillmentDate = (id) => {
    let fulfillDate
    _search
      .create({
        type: _search.Type.TRANSACTION,
        filters: [
          {
            name: 'type',
            operator: _search.Operator.ANYOF,
            values: ['ItemShip'],
          },
          {
            name: 'createdfrom',
            operator: _search.Operator.ANYOF,
            values: [id],
          },
          {
            name: 'mainline',
            operator: _search.Operator.IS,
            values: true,
          },
        ],
        columns: [{ name: 'trandate' }],
      })
      .run()
      .each((result) => {
        fulfillDate = result.getValue({ name: 'trandate' })
        return true
      })

    if (fulfillDate) return fulfillDate
  }

  const manualRun = () => {
    let pendingOrders = []
    var sf = [
      ['type', 'anyof', 'SalesOrd'],
      'AND',
      ['status', 'anyof', 'SalesOrd:F'],
      'AND',
      [
        'item.type',
        'anyof',
        'Assembly',
        'InvtPart',
        'Group',
        'Kit',
        'Service',
      ],
      'AND',
    ]

    var soIds = [
      '10823672',
      // '8970777',
      // '5030051',
      // '9185899',
      // '9750563',
      // '11826276',
      // '8867793',
      // '4462401',
      // '8894703',
      // '8867469',
      // '11866335',
      // '7055959',
      // '8867367',
      // '11788936',
    ]
    soIds.forEach((id) => {
      sf.push(['internalidnumber', 'equalto', id])
      sf.push('OR')
    })
    sf.pop()

    var sc = [
      { name: 'internalid' },
      { name: 'trandate' },
      { name: 'trandate', join: 'fulfillingTransaction' },
    ]

    _search
      .create({
        type: _search.Type.TRANSACTION,
        filters: sf,
        columns: sc,
      })
      .run()
      .each((result) => {
        pendingOrders.push({
          id: result.id,
          trandate: result.getValue({ name: 'trandate' }),
          fulfillDate: result.getValue({
            name: 'trandate',
            join: 'fulfillingTransaction',
          }),
        })
        return true
      })

    return pendingOrders
  }

  const populateErrors = (errorObj, order) => {
    // name & external id must be the same to avoid duplicates.
    const errorRecord = _record.create({
      type: 'customrecord_errors_invoice',
      isDynamic: true,
    })

    errorRecord.setValue({
      fieldId: 'name',
      value: `SO_${order.id}`,
    })

    errorRecord.setValue({
      fieldId: 'externalid',
      value: `SO_${order.id}`,
    })

    errorRecord.setValue({
      fieldId: 'custrecord_error_so',
      value: order.id,
    })

    errorRecord.setValue({
      fieldId: 'custrecord_errors',
      value: errorObj.message,
    })

    errorRecord.setValue({
      fieldId: 'custrecord_error_status',
      value: 1,
    })

    let errorId = errorRecord.save()

    _record.submitFields({
      type: _record.Type.SALES_ORDER,
      id: order.id,
      values: {
        custbody_invoice_error: true,
        custbody_error_record: errorId,
      },
    })
  }

  return {
    execute: execute,
  }
})
