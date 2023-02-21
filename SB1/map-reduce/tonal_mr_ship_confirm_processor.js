/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/format'], function (
  search,
  record,
  format,
) {
  const getInputData = () => {
    try {
      const shipConfirm = []
      search
        .create({
          type: 'customrecord_ship_confirm_staging',
          filters: [
            {
              name: 'custrecord_stg_sc_status',
              operator: search.Operator.ANYOF,
              values: ['1'],
            },
            {
              name: 'isinactive',
              operator: search.Operator.IS,
              values: false,
            },
          ],
          columns: [
            { name: 'internalid' },
            { name: 'name' },
            { name: 'custrecord_stg_sc_bo_so' },
            { name: 'custrecord_stg_sc_header' },
            { name: 'custrecord_stg_sc_lines' },
            { name: 'custrecord_stg_sc_file_name' },
          ],
        })
        .run()
        .each((confirmation) => {
          let cr = {
            id: confirmation.getValue({ name: 'internalid' }),
            name: confirmation.getValue({ name: 'name' }),
            bulkSo: confirmation.getValue({
              name: 'custrecord_stg_sc_bo_so',
            }),
            header: confirmation.getValue({
              name: 'custrecord_stg_sc_header',
            }),
            lines: confirmation.getValue({
              name: 'custrecord_stg_sc_lines',
            }),
            filename: confirmation.getValue({
              name: 'custrecord_stg_sc_file_name',
            }),
          }
          shipConfirm.push(cr)
          return true
        })

      return shipConfirm
    } catch (e) {
      log.debug('ERROR', e)
      log.debug('ERROR - STACK', e.stack)
    }
  }

  const map = (context) => {
    try {
      let input = JSON.parse(context.value)
      let header,
        stgLines,
        bulkSoLines,
        salesOrder,
        stageSCLines,
        filename,
        stageId

      filename = input.filename
      stageId = input.id
      if (
        typeof input.header === 'string' &&
        typeof input.lines === 'string'
      ) {
        header = JSON.parse(input.header)
        stgLines = JSON.parse(input.lines)
      }

      if (header['Distribution_Center'].startsWith('EXT') === true) {
        let id = header['Delivery_ID'].replace(/\D/g, '')
        salesOrder = fetchBulkSalesOrder(id)
        bulkSoLines = fetchBulkSalesOrderLines(id)
        stageSCLines = extractExtronItems(stgLines)
      }

      if (header['Distribution_Center'].startsWith('GIL') === true) {
        let id = header['PICK_NUMBER'].replace(/\D/g, '')
        salesOrder = fetchBulkSalesOrder(id)
        bulkSoLines = fetchBulkSalesOrderLines(id)
        stageSCLines = extractGilbertItems(stgLines)
      }

      var key = header['BULK_ID']
        ? header['BULK_ID']
        : header['Order_Number']

      if (
        salesOrder.length > 0 &&
        bulkSoLines.length > 0 &&
        stageSCLines.length > 0
      ) {
        context.write({
          key: key,
          value: {
            header,
            stgLines,
            salesOrder,
            bulkSoLines,
            stageSCLines,
            filename,
            stageId,
          },
        })
      } else {
        log.debug(
          'STAGE SHIP CONFIRM RECORD ID WITHOUT ORDER INFORMATION IN NETSUITE',
          input.id,
        )
      }

      // TODO: If the arrays are empty, KEY = FAILED, VALUES = IDs - ERROR OUT STAGING RECORDS
    } catch (e) {
      log.debug('ERROR - MAP', e)
      log.debug('ERROR - MAP', e.stack)
    }

    // TODO: Compare stgLines Against Lines
    // TODO: If Items are missing report error on bulk sales order line
    // TODO: If no Items are missing create Inventory Transfer ( Ship Inventory Transfer Only)
  }

  const reduce = (context) => {
    log.debug('KEY', context.key)
    try {
      let orders = context.values
      let shipInvXferId
      orders.forEach((order) => {
        order = JSON.parse(order)
        let stageSCLines, comparison, shipDate

        if (
          order.header['Distribution_Center'].startsWith('GIL') ===
          true
        ) {
          shipDate = order.header['SHIP_DATE']
          stageSCLines = removePhantomSKUs(order.stageSCLines)
          stageSCLines = updateGilbertItems(stageSCLines)
        }

        if (
          order.header['Distribution_Center'].startsWith('EXT') ===
          true
        ) {
          stageSCLines = removePhantomSKUs(order.stageSCLines)
          shipDate = order.stgLines[0]['Ship_Date']
        }
        comparison = compareItems(stageSCLines, order.bulkSoLines)

        if (
          comparison.uniqueStageShipConfirmLines.length >
          comparison.uniqueBulkSalesOrderLines.length
        ) {
          //TODO: ADD LOGIC TO RETURN AN ERROR ON THE STAGE RECORD
          //TODO: if ship confirm items != bulk sales Order items check against items first, if items match then call quantitiesMismatch fn.
          //TODO: IMPLEMENT COMPARISON LOGIC FOR QUANTITY. SAME AS ITEM COMPARISON.
          log.debug('ERROR', comparison.uniqueStageShipConfirmLines)
        }

        if (
          comparison.uniqueStageShipConfirmLines.length ===
            comparison.uniqueBulkSalesOrderLines.length ||
          comparison.uniqueBulkSalesOrderLines.length >
            comparison.uniqueStageShipConfirmLines.length
        ) {
          shipInvXferId = addShipInventoryTransfer(
            order.bulkSoLines,
            shipDate,
            order.salesOrder,
            order.header,
          )
          if (shipInvXferId && shipInvXferId !== null) {
            updateBulkSoLines(
              shipInvXferId,
              shipDate,
              order.bulkSoLines,
              order.stageSCLines,
              order.filename,
            )
          }

          updateStagingShipConfirm(
            order.salesOrder,
            shipInvXferId,
            order.stageId,
          )
        }
      })
    } catch (e) {
      log.debug('ERROR - REDUCE - Object', e)
      log.debug('ERROR - REDUCE - Stack Trace', e.stack)
    }
  }

  const summarize = (context) => {}

  const fetchBulkSalesOrder = (deliveryId) => {
    try {
      const salesOrders = []
      search
        .create({
          type: 'customrecord_bulk_sales_order',
          filters: [
            {
              name: 'custrecord_bo_so_customer_order_no',
              operator: search.Operator.IS,
              values: [deliveryId],
            },
            {
              name: 'isinactive',
              operator: search.Operator.IS,
              values: false,
            },
          ],
          columns: [
            { name: 'internalid' },
            { name: 'name' },
            { name: 'custrecord_bo_so_parent' },
            { name: 'custrecord_bo_so_customer_order_no' },
            {
              name: 'custrecord_bo_from_location',
              join: 'CUSTRECORD_BO_SO_PARENT',
            },
            {
              name: 'custrecord_bo_in_transit_location',
              join: 'CUSTRECORD_BO_SO_PARENT',
            },
            {
              name: 'internalid',
              join: 'CUSTRECORD_BO_SO_PARENT',
            },
          ],
        })
        .run()
        .each((salesOrder) => {
          let order = {
            id: salesOrder.getValue({ name: 'internalid' }),
            name: salesOrder.getValue({ name: 'name' }),
            order: salesOrder.getValue({
              name: 'custrecord_bo_so_customer_order_no',
            }),
            bulk: salesOrder.getValue({
              name: 'custrecord_bo_so_parent',
            }),
            from: salesOrder.getValue({
              name: 'custrecord_bo_from_location',
              join: 'CUSTRECORD_BO_SO_PARENT',
            }),
            to: salesOrder.getValue({
              name: 'custrecord_bo_in_transit_location',
              join: 'CUSTRECORD_BO_SO_PARENT',
            }),
            bulkId: salesOrder.getValue({
              name: 'internalid',
              join: 'CUSTRECORD_BO_SO_PARENT',
            }),
          }
          salesOrders.push(order)
          return true
        })

      return salesOrders
    } catch (e) {
      log.debug('ERROR - FETCH_BULK_SALES_ORDER', e)
    }
  }

  const fetchBulkSalesOrderLines = (deliveryId) => {
    try {
      const lines = []
      search
        .create({
          type: 'customrecord_bulk_order_so_lines',
          filters: [
            {
              name: 'name',
              operator: search.Operator.CONTAINS,
              values: [deliveryId],
            },
          ],
          columns: [
            { name: 'internalid' },
            { name: 'name' },
            { name: 'custrecord_bo_so_line_item' },
            { name: 'custrecord_bo_so_line_released_qty' },
          ],
        })
        .run()
        .each((bulkLine) => {
          let line = {
            id: bulkLine.getValue({ name: 'internalid' }),
            name: bulkLine.getValue({ name: 'name' }),
            item: bulkLine.getValue({
              name: 'custrecord_bo_so_line_item',
            }),
            itemName: bulkLine.getText({
              name: 'custrecord_bo_so_line_item',
            }),
            qty: bulkLine.getValue({
              name: 'custrecord_bo_so_line_released_qty',
            }),
          }
          lines.push(line)
          return true
        })

      return lines
    } catch (e) {
      log.debug('ERROR - FETCH_BULK_SALES_ORDER_LINES', e)
    }
  }

  const extractExtronItems = (stgLines) => {
    try {
      const lines = []
      stgLines.forEach((line) => {
        lines.push({
          item: line['Ordered_Item'],
          shipDate: line['Ship_Date'],
          serial: line['Serial_Number1'],
          serial2: line['Serial_Number2'],
          serial3: line['Serial_Number3'],
          qty: line['Box_Qty'],
        })
      })

      return lines
    } catch (e) {
      log.debug('ERROR - EXTRACT_EXTRON_ITEMS')
    }
  }

  const extractGilbertItems = (stgLines) => {
    try {
      const lines = []
      stgLines.forEach((line) => {
        lines.push({
          item: line['STYLE'],
          shipDate: line['ORDER_NUMBER'].split('-')[0],
          serial: line['SERIAL_NUMBER'],
          qty: line['QUANTITY_SHIPPED'],
        })
      })

      return lines
    } catch (e) {
      log.debug('ERROR - EXTRACT_GILBERT_ITEMS', e)
    }
  }

  const updateGilbertItems = (lines) => {
    //removal
    let qty = lines[0].qty
    const gilbertItems = removePhantomSKUs(lines)

    let items = ['160-0003', '121-0006', '121-0007']
    // addition
    for (var i = 0; i < items.length; i++) {
      gilbertItems.push({
        item: items[i],
        qty: qty,
      })
    }
    return gilbertItems
  }

  const removePhantomSKUs = (lines) => {
    return lines.filter((line) => {
      if (line.item !== '160-0001' && line.item !== '150-0001')
        return line.item
    })
  }

  const compareItems = (stageSCLines, bulkSoLines) => {
    let uniqueSCLines = stageSCLines.filter((stageScLine) => {
      return !bulkSoLines.some((bulkSoLine) => {
        return stageScLine.item === bulkSoLine.itemName
      })
    })

    let uniqueBulkSoLines = bulkSoLines.filter((bulkSoLine) => {
      return !stageSCLines.some((stageScLine) => {
        return bulkSoLine.itemName === stageScLine.item
      })
    })

    return {
      uniqueStageShipConfirmLines: uniqueSCLines,
      uniqueBulkSalesOrderLines: uniqueBulkSoLines,
    }
  }

  const quantitiesMismatch = (
    uniqueStageShipConfirmLines,
    bulkSoLines,
  ) => {
    let item = uniqueStageShipConfirmLines[0].item
    let qty = uniqueStageShipConfirmLines[0].qty

    let bulkItem = bulkSoLines.filter(
      (bulkSoLine) => bulkSoLine.itemName === item,
    )

    if (bulkItem[0].qty !== qty) {
      // TODO: Update ship confirm stage record with error.
    }
  }

  const updateStagingStatus = (stageId, status, key) => {
    switch (status) {
      case 1:
        break
      case 2:
        break
      case 3:
        break
      case 4:
        failedStagingRecord(stageId, status, `MISSING_${key}`)
        break
    }
  }

  const addShipInventoryTransfer = (
    bulkSoLines,
    shipDate,
    salesOrder,
    header,
  ) => {
    let orderNumber, eID
    if (header['Distribution_Center'].startsWith('EXT') === true) {
      orderNumber = header['Order_Number']
      eID =
        header['Order_Number'] + '_' + header['Delivery_ID'] + '_S'
    } else {
      eID = header['BULK_ID'] + '_' + header['PICK_NUMBER'] + '_S'
      orderNumber = header['BULK_ID']
    }

    let inventoryTransfer = record.create({
      type: record.Type.INVENTORY_TRANSFER,
      isDynamic: true,
    })

    inventoryTransfer.setValue({ fieldId: 'subsidiary', value: 1 })
    inventoryTransfer.setValue({ fieldId: 'externalid', value: eID })

    let dateShipped = formatDate(shipDate)
    inventoryTransfer.setValue({
      fieldId: 'trandate',
      value: dateShipped,
    })

    inventoryTransfer.setValue({
      fieldId: 'location',
      value: salesOrder[0].from,
    })

    inventoryTransfer.setValue({
      fieldId: 'transferlocation',
      value: salesOrder[0].to,
    })

    inventoryTransfer.setValue({
      fieldId: 'custbody_customer_order_no',
      value: salesOrder[0].order,
    })

    inventoryTransfer.setValue({
      fieldId: 'custbody_tonal_bulk_order_no',
      value: orderNumber,
    })

    inventoryTransfer.setValue({
      fieldId: 'custbody_inventory_transfer_type',
      value: 1,
    })

    inventoryTransfer.setValue({
      fieldId: 'custbody_ns_bulk_order_no',
      value: salesOrder[0].bulkId,
    })

    bulkSoLines.forEach((bulkSoLine) => {
      inventoryTransfer.selectNewLine({ sublistId: 'inventory' })
      inventoryTransfer.setCurrentSublistValue({
        sublistId: 'inventory',
        fieldId: 'item',
        value: bulkSoLine.item,
      })
      inventoryTransfer.setCurrentSublistValue({
        sublistId: 'inventory',
        fieldId: 'adjustqtyby',
        value: bulkSoLine.qty,
      })
      inventoryTransfer.commitLine({ sublistId: 'inventory' })
    })

    let transfers = checkInventoryTransfer(eID)
    log.debug('transfers', transfers)

    let inventoryTransferId

    if (transfers && transfers.length === 1) {
      inventoryTransferId = transfers[0].id
    } else if (transfers.length === 0) {
      inventoryTransferId = inventoryTransfer.save()
    }

    return inventoryTransferId
  }

  const updateBulkSoLines = (
    shipInvXferId,
    shipDate,
    bulkSoLines,
    stageSCLines,
    filename,
  ) => {
    try {
      bulkSoLines.forEach((bulkSoLine) => {
        let bulkSo = record.load({
          type: 'customrecord_bulk_order_so_lines',
          id: bulkSoLine.id,
          isDynamic: true,
        })

        let serializedItem = stageSCLines.filter(
          (line) => line.item === '100-0002',
        )

        if (bulkSoLine.itemName === serializedItem[0]['item']) {
          bulkSo.setValue({
            fieldId: 'custrecord_bo_so_line_serial_num',
            value: serializedItem[0]['serial'],
          })
        }

        bulkSo.setValue({
          fieldId: 'custrecord_bo_so_line_shipped_qty',
          value: bulkSoLine.qty,
        })

        bulkSo.setValue({
          fieldId: 'custrecord_bo_so_line_ship_inv_trans',
          value: shipInvXferId,
        })

        let dateShipped = formatDate(shipDate)
        bulkSo.setValue({
          fieldId: 'custrecord_bo_so_line_ship_date',
          value: dateShipped,
        })

        bulkSo.setValue({
          fieldId: 'custrecord_bo_so_line_ship_file_name',
          value: filename,
        })

        bulkSo.setValue({
          fieldId: 'custrecord_bo_so_line_status_dynamic',
          value: 1,
        })

        bulkSo.save()
      })
    } catch (e) {
      log.debug('ERROR -UPDATE BULK SO LINES', e)
    }
  }

  const updateStagingShipConfirm = (
    salesOrder,
    shipInvXferId,
    stageId,
  ) => {
    log.debug('salesOrder', salesOrder)
    log.debug('shipInvXferId', shipInvXferId)
    log.debug('stageId', stageId)

    let stageRecord = record.load({
      type: 'customrecord_ship_confirm_staging',
      id: stageId,
      isDynamic: true,
    })

    stageRecord.setValue({
      fieldId: 'custrecord_stg_sc_status',
      value: 2,
    })
    stageRecord.setValue({
      fieldId: 'custrecord_stg_sc_inventory_transfer',
      value: shipInvXferId,
    })
    stageRecord.setValue({
      fieldId: 'custrecord_stg_sc_process_date',
      value: new Date(),
    })
    stageRecord.setValue({
      fieldId: 'custrecord_stg_sc_bo_so',
      value: salesOrder[0].id,
    })
    stageRecord.save()
  }

  const failedStagingRecord = (stageId, status, reason) => {
    let stgRec = record.load({
      type: 'customrecord_ship_confirm_staging',
      id: stageId,
      isDynamic: true,
    })
    stgRec.setValue({
      fieldId: 'custrecord_stg_sc_status',
      value: status,
    })
    stgRec.setValue({
      fieldId: 'custrecord_stg_sc_error_message',
      value: '[' + new Date() + '] - ERROR: ' + reason,
    })
    stgRec.save()
  }

  const checkInventoryTransfer = (externalid) => {
    try {
      const transfers = []
      search
        .create({
          type: search.Type.TRANSACTION,
          filters: [
            {
              name: 'type',
              operator: search.Operator.ANYOF,
              values: ['InvTrnfr'],
            },
            {
              name: 'externalidstring',
              operator: search.Operator.IS,
              values: [externalid],
            },
            {
              name: 'mainline',
              operator: search.Operator.IS,
              values: true,
            },
          ],
          columns: [{ name: 'internalid' }],
        })
        .run()
        .each((transfer) => {
          transfers.push({
            id: transfer.getValue({ name: 'internalid' }),
          })
          return true
        })

      return transfers
    } catch (e) {
      log.debug('checkInventoryTransfer', e)
    }
  }

  const formatDate = (input) => {
    switch (input.length) {
      case 6:
      case 8:
        let temp = new Date(
          input.slice(4, 6) +
            '-' +
            input.slice(6, 8) +
            '-' +
            input.slice(0, 4),
        )
        let out = format.parse({
          value: temp,
          type: format.Type.DATE,
        })
        return out
      case 11:
        let temp1 = new Date(input)
        let output = format.parse({
          value: temp1,
          type: format.Type.DATE,
        })
        return output
    }
  }

  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize,
  }
})
