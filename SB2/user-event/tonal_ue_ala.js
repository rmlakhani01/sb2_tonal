/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/record'], function (search, record) {
  function afterSubmit(context) {
    try {
      if (context.type === 'create') {
        salesOrderCreateEvent(context)
      }

      if (context.type === 'edit') {
        salesOrderEditEvent(context)
      }
    } catch (error) {
      log.debug('error', error)
      log.debug('error stack', error.stack)
    }
  }

  const getLastMileHub = (zip) => {
    let lastMileHub = []
    search
      .create({
        type: 'customrecord_lm_coverage',
        filters: [
          {
            name: 'custrecord_customer_zip',
            operator: search.Operator.IS,
            values: zip,
          },
          {
            name: 'custrecord_lm_weight_coverage',
            operator: search.Operator.GREATERTHANOREQUALTO,
            values: 1,
          },
        ],
        columns: [
          { name: 'custrecord_lm_location' },
          {
            name: 'custrecord_distance_to_customer',
            sort: search.Sort.ASC,
          },
          { name: 'custrecord_lm_weight_coverage' },
        ],
      })
      .run()
      .each((lmh) => {
        lastMileHub.push(lmh)
        return true
      })

    return lastMileHub
  }

  // weight based selection algorithm
  const computeDestinationLocation = (lmh, order) => {
    const locations = []
    let sumRange = 0
    // get the details from the search
    lmh.forEach((hub) => {
      let location = {
        id: hub.getValue({ name: 'custrecord_lm_location' }),
        distance: parseInt(
          hub.getValue({
            name: 'custrecord_distance_to_customer',
            sort: search.Sort.ASC,
          }),
        ),
      }
      locations.push(location)
    })

    locations.forEach((location) => (sumRange += location.distance))

    //determine ranges based on distance
    for (var i = 0; i < locations.length; i += 1) {
      if (i === 0) {
        locations[i]['boundary_' + i + '_start'] = 1
        locations[i]['boundary_' + i + '_end'] =
          locations[i]['distance']
      }

      if (i > 0) {
        locations[i]['boundary_' + i + '_start'] =
          locations[i - 1]['distance'] + 1
        locations[i]['boundary_' + i + '_end'] =
          locations[i]['distance']
      }

      if (i === locations.length - 1) {
        locations[i]['boundary_' + i + '_start'] =
          locations[i - 1]['distance'] + 1
        locations[i]['boundary_' + i + '_end'] = sumRange
      }
    }

    // select location that the delta is equalto or fits in the ranges
    let indexedResults = []
    let delta = getDelta(0, sumRange)
    locations.forEach((location, index) => {
      var local
      for (const [key, value] of Object.entries(location)) {
        var start, end
        if (key.includes('start') === true) {
          start = value
        }

        if (key.includes('end') === true) {
          end = value
        }

        if (start !== undefined && end !== undefined) {
          if (
            delta !== start &&
            delta > start &&
            delta !== end &&
            delta < end
          ) {
            local = index
            break
          }

          if (delta === start || delta === end) {
            local = index
            break
          }
        }
      }
      if (local !== undefined) indexedResults.push(location)
    })
    order.destinationDetails = indexedResults
    order.locations = locations
    order.sumRange = sumRange
    order.generatedNumber = delta

    return indexedResults[0].id
  }

  const getDelta = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  const getCustomerZip = (address, order) => {
    order.zip = address.getValue({ fieldId: 'zip' })
    if (order.zip && order.zip.length === 4)
      order.zip = '0' + order.zip

    return order.zip
  }

  const lookupRecordValues = (recordType, fieldId, id) => {
    return search.lookupFields({
      type: recordType,
      id: id,
      columns: [fieldId],
    })
  }

  const extractItemsFromLines = (numberOfLines, newRecord) => {
    const items = []
    for (var i = 0; i < numberOfLines; i += 1) {
      const item = {}
      item.itemType = newRecord.getSublistValue({
        sublistId: 'item',
        fieldId: 'itemtype',
        line: i,
      })

      if (item.itemType === 'InvtPart' || item.itemType === 'Kit') {
        item.itemId = newRecord.getSublistValue({
          sublistId: 'item',
          fieldId: 'item',
          line: i,
        })

        if (item.itemType === 'InvtPart')
          item.itemType = search.Type.INVENTORY_ITEM
        if (item.itemType === 'Kit')
          item.itemType = search.Type.KIT_ITEM

        item.installRequired = lookupRecordValues(
          item.itemType,
          'custitem_install_req',
          item.itemId,
        )
        if (item.installRequired.custitem_install_req.length !== 0) {
          item.installRequired =
            item.installRequired.custitem_install_req[0].text
        } else item.installRequired = 'No'
        items.push(item)
      }
    }

    return items
  }

  const salesOrderCreateEvent = (context) => {
    const order = {}
    const rec = context.newRecord
    order.customerId = rec.getValue({ fieldId: 'entity' })
    order.orderStatus = rec.getValue({
      fieldId: 'orderstatus',
    })
    order.numberOfLines = rec.getLineCount({
      sublistId: 'item',
    })
    order.customerInstallRequired = lookupRecordValues(
      'customer',
      'custentity_install_req',
      order.customerId,
    ).custentity_install_req[0].text
    order.items = extractItemsFromLines(order.numberOfLines, rec)

    const address = rec.getSubrecord({
      fieldId: 'shippingaddress',
    })

    getCustomerZip(address, order)
    order.lastMileHub = getLastMileHub(order.zip)

    if (order.lastMileHub.length === 0) {
      throw new Error(
        'Last Mile Hub could not be found with this zip: ' +
          order.zip,
      )
    }

    if (order.lastMileHub.length === 1) {
      const salesorder = record.load({
        type: record.Type.SALES_ORDER,
        id: rec.id,
      })

      for (var i = 0; i < order.numberOfLines; i += 1) {
        salesorder.setSublistValue({
          sublistId: 'item',
          fieldId: 'location',
          line: i,
          value: order.lastMileHub[0].getValue({
            name: 'custrecord_lm_location',
          }),
        })
      }
      salesorder.save()
    }

    if (order.lastMileHub.length > 1) {
      order.destination = computeDestinationLocation(
        order.lastMileHub,
        order,
      )
      const salesorder = record.load({
        type: record.Type.SALES_ORDER,
        id: rec.id,
      })
      for (var y = 0; y < order.numberOfLines; y += 1) {
        salesorder.setSublistValue({
          sublistId: 'item',
          fieldId: 'location',
          line: y,
          value: order.destination,
        })
      }

      salesorder.save()
    }

    log.debug('order object', order)
  }

  const salesOrderEditEvent = (context) => {
    const order = {}
    let oldRecord = context.oldRecord
    let newRecord = context.newRecord

    let oldAddress = oldRecord.getSubrecord({
      fieldId: 'shippingaddress',
    })
    let newAddress = newRecord.getSubrecord({
      fieldId: 'shippingaddress',
    })

    let oldZip = oldAddress.getValue({ fieldId: 'zip' })
    let newZip = newAddress.getValue({ fieldId: 'zip' })

    if (oldZip !== newZip) {
      order.numberOfLines = newRecord.getLineCount({
        sublistId: 'item',
      })

      getCustomerZip(newAddress, order)
      order.lastMileHub = getLastMileHub(order.zip)

      if (order.lastMileHub.length === 0) {
        throw new Error(
          'Last Mile Hub could not be found with this zip: ' +
            order.zip,
        )
      }

      if (order.lastMileHub.length === 1) {
        const salesorder = record.load({
          type: record.Type.SALES_ORDER,
          id: newRecord.id,
        })

        for (var i = 0; i < order.numberOfLines; i += 1) {
          salesorder.setSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            line: i,
            value: order.lastMileHub[0].getValue({
              name: 'custrecord_lm_location',
            }),
          })
        }
        salesorder.save()
      }

      if (order.lastMileHub.length > 1) {
        order.destination = computeDestinationLocation(
          order.lastMileHub,
          order,
        )
        const salesorder = record.load({
          type: record.Type.SALES_ORDER,
          id: newRecord.id,
        })
        for (var y = 0; y < order.numberOfLines; y += 1) {
          salesorder.setSublistValue({
            sublistId: 'item',
            fieldId: 'location',
            line: y,
            value: order.destination,
          })
        }

        salesorder.save()
      }
      log.debug('order object', order)
    }
  }

  return {
    afterSubmit: afterSubmit,
  }
})
