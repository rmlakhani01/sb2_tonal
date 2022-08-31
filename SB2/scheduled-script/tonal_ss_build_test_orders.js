/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 */
define(['N/search', 'N/record'], function (search, record) {
  function execute(context) {
    //testOrderOne()
    //testOrderTwo()
    //testOrderThree()
    //testOrderFour()
    // testOrderFive()
    // testOrderEight()
    // testOrderNine()
    testOrderTen()
  }

  const testOrderOne = () => {
    try {
      var items = ['1704', '13', '1705', '1706', '1707', '1688']

      var salesorder = record.create({
        type: record.Type.SALES_ORDER,
        isDynamic: true,
      })
      salesorder.setValue({
        fieldId: 'memo',
        value: 'TO-Create-00001',
      })
      salesorder.setValue({ fieldId: 'entity', value: 737684 })
      for (var i = 0; i < items.length; i++) {
        salesorder.selectNewLine({ sublistId: 'item' })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          value: items[i],
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'quantity',
          value: 1,
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'amount',
          value: 50.0,
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'location',
          value: 136,
        })
        salesorder.commitLine({ sublistId: 'item' })
      }
      salesorder.save()
    } catch (error) {
      log.debug('error', error.message)
      log.debug('error', error.stack)
    }
  }

  const testOrderTwo = () => {
    try {
      for (var y = 0; y < 4; y++) {
        var items = [1704, 13, 1705, 1706, 1707, 1688]

        var salesorder = record.create({
          type: record.Type.SALES_ORDER,
          isDynamic: true,
        })
        salesorder.setValue({
          fieldId: 'memo',
          value: 'TO-Create-00002',
        })
        salesorder.setValue({ fieldId: 'entity', value: 737684 })

        for (var i = 0; i < items.length; i++) {
          salesorder.selectNewLine({ sublistId: 'item' })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: items[i],
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            value: 50.0,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: 1,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            value: 136,
          })
          salesorder.commitLine({ sublistId: 'item' })
        }
        salesorder.save()
      }
    } catch (error) {
      log.debug('error', error.message)
      log.debug('error', error.stack)
    }
  }

  const testOrderThree = () => {
    for (var y = 0; y < 16; y++) {
      var items = [1704, 13, 1705, 1706, 1707, 1688]

      var salesorder = record.create({
        type: record.Type.SALES_ORDER,
        isDynamic: true,
      })
      salesorder.setValue({
        fieldId: 'memo',
        value: 'TO-Create-00003',
      })
      salesorder.setValue({ fieldId: 'entity', value: 737684 })
      for (var i = 0; i < items.length; i++) {
        salesorder.selectNewLine({ sublistId: 'item' })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          value: items[i],
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'quantity',
          value: 1,
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'amount',
          value: 50.0,
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'location',
          value: 136,
        })
        salesorder.commitLine({ sublistId: 'item' })
      }
      salesorder.save()
    }
  }

  const testOrderFour = () => {
    for (var y = 0; y < 40; y++) {
      var items = [1704, 13, 1705, 1706, 1707, 1688]

      var salesorder = record.create({
        type: record.Type.SALES_ORDER,
        isDynamic: true,
      })
      salesorder.setValue({
        fieldId: 'memo',
        value: 'TO-Create-00004',
      })
      salesorder.setValue({ fieldId: 'entity', value: 737684 })
      for (var i = 0; i < items.length; i++) {
        salesorder.selectNewLine({ sublistId: 'item' })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          value: items[i],
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'quantity',
          value: 1,
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'amount',
          value: 50.0,
        })
        salesorder.setCurrentSublistValue({
          sublistId: 'item',
          fieldId: 'location',
          value: 136,
        })
        salesorder.commitLine({ sublistId: 'item' })
      }
      salesorder.save()
    }
  }

  const testOrderFive = () => {
    try {
      for (var y = 0; y < 6; y++) {
        var items = [1704, 13, 1705, 1706, 1707, 1688]

        var salesorder = record.create({
          type: record.Type.SALES_ORDER,
          isDynamic: true,
        })
        salesorder.setValue({
          fieldId: 'memo',
          value: 'TO-Create-00005',
        })
        salesorder.setValue({ fieldId: 'entity', value: 737684 })

        for (var i = 0; i < items.length; i++) {
          salesorder.selectNewLine({ sublistId: 'item' })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: items[i],
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: 1,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            value: 50.0,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'pricelevel',
            value: '-1',
          })

          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            value: 136,
          })
          salesorder.commitLine({ sublistId: 'item' })
        }
        salesorder.save()
      }
    } catch (error) {
      log.debug('error', error.message)
      log.debug('error', error.stack)
    }
  }

  const testOrderEight = () => {
    try {
      for (var y = 0; y < 4; y++) {
        var items = [1704, 13, 1705, 1706, 1707, 1688]

        var salesorder = record.create({
          type: record.Type.SALES_ORDER,
          isDynamic: true,
        })
        salesorder.setValue({
          fieldId: 'memo',
          value: 'TO-Create-00008',
        })
        salesorder.setValue({ fieldId: 'entity', value: 737684 })
        for (var i = 0; i < items.length; i++) {
          salesorder.selectNewLine({ sublistId: 'item' })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: items[i],
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: 1,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            value: 50.0,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            value: 82,
          })
          salesorder.commitLine({ sublistId: 'item' })
        }
        salesorder.save()
      }
    } catch (error) {
      log.debug('error', error.message)
      log.debug('error', error.stack)
    }
  }

  const testOrderNine = () => {
    try {
      for (var y = 0; y < 4; y++) {
        var items = [1704]

        var salesorder = record.create({
          type: record.Type.SALES_ORDER,
          isDynamic: true,
        })
        salesorder.setValue({
          fieldId: 'memo',
          value: 'TO-Create-00009',
        })
        salesorder.setValue({ fieldId: 'entity', value: 737684 })
        for (var i = 0; i < items.length; i++) {
          salesorder.selectNewLine({ sublistId: 'item' })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: items[i],
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: 1,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            value: 50.0,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            value: 96,
          })
          salesorder.commitLine({ sublistId: 'item' })
        }
        salesorder.save()
      }
    } catch (error) {
      log.debug('error', error.message)
      log.debug('error', error.stack)
    }
  }

  const testOrderTen = () => {
    try {
      for (var y = 0; y < 45; y++) {
        var items = [1704, 13, 1705, 1706, 1707, 1688]

        var salesorder = record.create({
          type: record.Type.SALES_ORDER,
          isDynamic: true,
        })
        salesorder.setValue({
          fieldId: 'memo',
          value: 'TO-Create-00006',
        })
        salesorder.setValue({ fieldId: 'entity', value: 737684 })
        for (var i = 0; i < items.length; i++) {
          salesorder.selectNewLine({ sublistId: 'item' })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'item',
            value: items[i],
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'quantity',
            value: 1,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'amount',
            value: 50.0,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'orderpriority',
            value: 3,
          })
          salesorder.setCurrentSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            value: 96,
          })
          salesorder.commitLine({ sublistId: 'item' })
        }
        salesorder.save()
      }
    } catch (error) {
      log.debug('error', error.message)
      log.debug('error', error.stack)
    }
  }

  return {
    execute: execute,
  }
})
