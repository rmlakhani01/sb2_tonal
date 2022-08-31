/**
 *@NApiVersion 2.1
 *@NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/file', 'N/sftp'], function (
  search,
  record,
  file,
  sftp,
) {
  function getInputData(context) {
    const transferOrders = []
    search
      .create({
        type: 'transaction',
        filters: [
          {
            name: 'type',
            operator: search.Operator.ANYOF,
            values: 'TrnfrOrd',
          },
          {
            name: 'mainline',
            operator: search.Operator.IS,
            values: true,
          },
          {
            name: 'status',
            operator: search.Operator.ANYOF,
            values: 'TrnfrOrd:B',
          },
        ],
        columns: [
          { name: 'internalid' },
          { name: 'location' },
          { name: 'transferlocation' },
          {
            name: 'custbodysalesforce_order_id',
            join: 'custcol_sales_order',
          },
          {
            name: 'trandate',
          },
        ],
      })
      .run()
      .each((result) => {
        let order = {
          id: result.getValue({ name: 'internalid' }),
          carrier: result
            .getText({ name: 'location' })
            .split(':')[0]
            .replace(/\s+/g, ''),
          shipAddress: result.getValue({ name: 'transferlocation' }),
          sfOrderID: result.getValue({
            name: 'custbodysalesforce_order_id',
            join: 'custcol_sales_order',
          }),
          date: result.getValue({ name: 'trandate' }),
        }
        transferOrders.push(order)
        return true
      })

    return transferOrders
  }

  function map(context) {
    const data = JSON.parse(context.value)
    let orderDetails = getTransferOrderLines(
      data.id,
      data.shipAddress,
    )

    context.write({
      key: data.carrier,
      value: orderDetails,
    })
  }

  function reduce(context) {
    try {
      const carrier = context.key
      const details = context.values
      if (carrier === 'Gilbert-FG') {
        let csv = transferOrderDetails_Gilbert(details)
        let connection = sftp.createConnection({
          username: 'tonal1',
          password: 't0!aLe5#s',
          url: '50.206.40.20',
          directory: '/home/TONAL/Test/Inbound',
          port: 22,
        })
        const datafile = file.create({
          name: getFileName(),
          fileType: file.Type.CSV,
          contents: csv,
          folder: 784,
        })
        const fileId = datafile.save()
        log.debug('fileId: ' + fileId)
      }
    } catch (error) {
      log.debug('error: ' + error)
    }
  }

  function summarize(summary) {
    // log.debug('summarize', summary)
  }

  const getTransferOrderLines = (orderId, shipAddress) => {
    const lines = []
    const transferOrder = record.load({
      type: record.Type.TRANSFER_ORDER,
      id: orderId,
    })
    const numberOfLines = transferOrder.getLineCount({
      sublistId: 'item',
    })

    const date = transferOrder.getValue({ fieldId: 'trandate' })

    for (let i = 0; i < numberOfLines; i++) {
      let orderLine = {}
      orderLine.id = orderId
      orderLine.date = transferOrder.getValue({ fieldId: 'trandate' })
      orderLine.orderId = transferOrder.getValue({
        fieldId: 'tranid',
      })

      orderLine.shipAddress = shipAddress
      orderLine.lineNumber = i
      orderLine.item = transferOrder.getSublistText({
        sublistId: 'item',
        fieldId: 'item',
        line: i,
      })
      orderLine.quantity = transferOrder.getSublistValue({
        sublistId: 'item',
        fieldId: 'quantity',
        line: i,
      })
      lines.push(orderLine)
    }
    return lines
  }

  const transferOrderDetails_Gilbert = (details) => {
    const transferOrders = details.map((order) => JSON.parse(order))
    // log.debug(`TransferOrderDetails`, transferOrders)
    let rows = []
    let csv = ''
    for (let order of transferOrders) {
      log.debug('order', order)
      // custbodysalesforce_order_id
      if (order.length > 1) {
        let shipAddress = getShipAddress(order[0].shipAddress)
        let header = getGilbertHeaders(order[0], shipAddress)
        let orderDetails = [...order]
        for (let i = 0; i < orderDetails.length; i++) {
          getGilbertData(orderDetails[i], rows)
        }
        csv += jsonToCSV(header, rows)
      }

      if (order.length === 1) {
        let shipAddress = getShipAddress(order[0].shipAddress)
        let header = getGilbertHeaders(order[0], shipAddress)
        getGilbertData(order[0], rows)
        csv += jsonToCSV(header, rows)
      }
    }
    return csv
  }

  const getShipAddress = (shipAddress) => {
    const location = record.load({
      type: record.Type.LOCATION,
      id: shipAddress,
    })
    let address = {}
    const addressSubrecord = location.getSubrecord({
      fieldId: 'mainaddress',
    })
    address.addressee = addressSubrecord.getValue({
      fieldId: 'addressee',
    })
    address.addr1 = addressSubrecord.getValue({ fieldId: 'addr1' })
    address.city = addressSubrecord.getValue({ fieldId: 'city' })
    address.state = addressSubrecord.getValue({ fieldId: 'state' })
    address.country = addressSubrecord.getValue({
      fieldId: 'country',
    })
    address.zip = addressSubrecord.getValue({ fieldId: 'zip' })

    return address
  }

  const getGilbertHeaders = (order, shipAddress) => {
    log.debug('headers - order', order)
    let date = order.date.slice(0, 10)
    let enddate = new Date(date)
    let endshipdate = `${enddate.getFullYear()}-${
      enddate.getMonth() + 1
    }-${
      enddate.getDate() < 10
        ? '0' + (enddate.getDate() + 2)
        : enddate.getDate() + 2
    }`
    let headers = {}
    ;(headers.ACTION_CODE = 'A'),
      (headers.HEADER_RECORD = 'H'),
      (headers.ORDER_NUMBER = order.orderId),
      (headers.PICK_NUMBER = order.orderId),
      (headers.ORDER_TYPE = 'CSP'),
      (headers.CUSTOMER = ''),
      (headers.STORE = ''),
      (headers.ROUTE_ID_SHIP_TO = ''),
      (headers.START_SHIP_DATE = date), // POPULATE THIS
      (headers.END_SHIP_DATE = endshipdate), // POPULATE THIS
      (headers.EARLY_SHIP_DATE = ''),
      (headers.ARRIVE_BY_DATE = ''),
      (headers.PO_NUMBER = ''),
      (headers.HOST_ORD_NUM = ''),
      (headers.DEPARTMENT_NUMBER = ''),
      (headers.DEPARTMENT_NAME = ''),
      (headers.SHIP_TO_NAME = shipAddress.addressee),
      (headers.SHIP_TO_ADDR1 = shipAddress.addr1),
      (headers.SHIP_TO_ADDR2 = ''),
      (headers.SHIP_TO_CITY = shipAddress.city),
      (headers.SHIP_TO_STATE = shipAddress.state),
      (headers.SHIP_TO_COUNTRY = shipAddress.country),
      (headers.SHIP_TO_ZIP = shipAddress.zip),
      (headers.LAST_MOD_DATE = ''),
      (headers.USER_ID = ''),
      (headers.MARKFOR_NAME = ''),
      (headers.MARKFOR_ADDRESS1 = ''),
      (headers.MARKFOR_ADDRESS2 = ''),
      (headers.MARKFOR_CITY = ''),
      (headers.MARKFOR_STATE = ''),
      (headers.MARKFOR_ZIPCODE = ''),
      (headers.MARKFOR_COUNTRY = ''),
      (headers.BILLTO_NAME = ''),
      (headers.BILLTO_ADDR1 = ''),
      (headers.BILLTO_ADDR2 = ''),
      (headers.BILLTO_CITY = ''),
      (headers.BILLTO_STATE = ''),
      (headers.BILLTO_ZIPCODE = ''),
      (headers.BILLTO_COUNTRY = ''),
      (headers.WAREHOUSE_ID = ''),
      (headers.SHIP_METHOD = ''),
      (headers.SHIP_VIA = ''),
      (headers.SHIP_TERMS = ''),
      (headers.PARCEL = ''),
      (headers.CUSTOMER_PO = ''),
      (headers.CONTACT_PHONE_NUM = ''),
      (headers.NOTES = ''),
      (headers.BILLTO_ID = ''),
      (headers.MARKFOR_ID = ''),
      (headers.FILLER = '' + '\r\n')

    return headers
  }

  const getGilbertData = (order, rows) => {
    let data = {}
    ;(data.DETAIL_RECORD = 'D'),
      (data.ORDER_NUMBER = order.orderId),
      (data.ORDER_LINE_NUMBER = order.lineNumber + 1),
      (data.DIVISION = ''),
      (data.STYLE = order.item),
      (data.COLOR = ''),
      (data.FIT = ''),
      (data.SIZE = ''),
      (data.DIM_PACK = ''),
      (data.UNIT_OF_MEASURE = ''),
      (data.UPC = ''),
      (data.EAN = ''),
      (data.QUANTITY_ORDERED = order.quantity),
      (data.PRICE = 0.0),
      (data.CUSTOMER_STYLE = ''),
      (data.CASE_QTY = ''),
      (data.CASE_PACK = ''),
      (data.DIM_LENGTH = '0'),
      (data.DIM_WIDTH = '0'),
      (data.DIM_HEIGHT = '0'),
      (data.DIM_CUBE = '0'),
      (data.WEIGHT = '0'),
      (data.NOTES = ''),
      (data.SERIAL_NUMBER = ''),
      (data.VERSION = ''),
      (data.PICK_NUMBER = order.sfOrderID + '\r\n')
    rows.push(data)
  }

  const jsonToCSV = (headers, data) => {
    const header = Object.values(headers)
    const csv = [
      header.join(','),
      ...data.map((row) => Object.values(row).join(',')),
    ]
    log.debug('csv', JSON.stringify(csv))

    return csv
  }

  const getFileName = () => {
    const date = getDate() //.replace(/\\/g, '')
    const code = 'LAX' // TEMP - TODO: NEEDS to be replaced by East Coast vs West Coast.

    const fileName = date + '-BULK3PLAN' + code + 'G'

    return fileName
  }

  const getDate = () => {
    const todaysDate = new Date()
    let year = todaysDate.getFullYear().toString().substr(-2)

    const orderDate =
      year + (todaysDate.getMonth() + 1) + todaysDate.getDate()

    // toLocaleDateString() doesn't appear to be supported by NetSuite.
    // const todaysDate = new Date().toLocaleDateString('en-US', {
    //   year: '2-digit',
    //   month: '2-digit',
    //   day: '2-digit',
    // })
    return orderDate
  }
  return {
    getInputData: getInputData,
    map: map,
    reduce: reduce,
    summarize: summarize,
  }
})
