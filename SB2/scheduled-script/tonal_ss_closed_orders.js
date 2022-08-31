/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
define(['N/record', 'N/search'], function (record, search) {
  function execute(context) {
    const results = getResults()
    processResults(results)
  }

  const getResults = () => {
    const results = []
    search
      .create({
        type: search.Type.TRANSACTION,
        filters: [
          {
            name: 'type',
            operator: search.Operator.ANYOF,
            values: 'SalesOrd',
          },
          {
            name: 'status',
            operator: search.Operator.ANYOF,
            values: ['SalesOrd:H'],
          },
          {
            name: 'custcol_transfer_order',
            operator: search.Operator.NONEOF,
            values: '@NONE@',
          },
        ],
        columns: ['internalid'],
      })
      .run()
      .each((soid) => {
        results.push(soid.getValue({ name: 'internalid' }))
      })

    return results
  }

  const processResults = (results) => {
    const to = new Set()
    const so = []
    results.forEach((soid) => {
      log.debug('sales order id', soid)
      const salesOrderRecord = record.load({
        type: record.Type.SALES_ORDER,
        id: soid,
        isDynamic: true,
      })
      const lineCount = salesOrderRecord.getLineCount({
        sublistId: 'item',
      })

      for (var i = 0; i < lineCount; i++) {
        to.add(
          salesOrderRecord.getSublistValue({
            sublistId: 'item',
            fieldId: 'custcol_transfer_order',
            line: i,
          }),
        )
      }
      so.push(soid)
    })

    for (var y = 0; y < so.length; y++) {
      for (const key of to) {
        const transferOrderRecord = record.load({
          type: record.Type.TRANSFER_ORDER,
          id: key,
          isDynamic: true,
        })

        const lineCount = transferOrderRecord.getLineCount({
          sublistId: 'item',
        })

        if (lineCount > 1) {
          for (var i = 0; i < lineCount; i++) {
            let lineNumber = transferOrderRecord.findSublistLineWithValue(
              {
                sublistId: 'item',
                fieldId: 'custcol_sales_order',
                value: so[y],
              },
            )
            if (lineNumber !== -1) {
              transferOrderRecord.removeLine({
                sublistId: 'item',
                line: lineNumber,
              })
            }
          }

          transferOrderRecord.save()
        }

        if (lineCount === 1) {
          record.delete({ type: record.Type.TRANSFER_ORDER, id: key })
          break
        }
      }
    }
  }

  return {
    execute: execute,
  }
})
