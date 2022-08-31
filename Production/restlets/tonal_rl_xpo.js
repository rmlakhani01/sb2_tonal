/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 */

// const input = {
//   order: '13391275',
//   products:
//     'Installation Kit 150-0005 | 41x19x2 in (15lbs); Bench 120-0009 | 46x14x7 in (22lbs); Bar 120-0003 | 41x2x2 in (4lbs); Accessories Combo Kit 160-0003 | 25x12x6 in (9lbs); Tonal Trainer | 54x24x7 in (152lbs); Kit 17-24in Wall Mount Adapter 150-0004 | 27x4x2 in (10lbs)',
//   freightFulfillmentMode: 'Consigned',
//   SKU: 'Trainer | 100-0001',
// }
define(['N/search', 'N/record'], function (search, record) {
  function _post(context) {
    try {
      log.debug('REQUEST', context)
      const input = context
      const data = input.products
      const output = []
      const product_data = data.split(';')
//      log.debug('number of products: ', product_data.length)
      product_data.forEach((product) => {
        let outputObj = {}
        let accountProduct = {}
        let details = product.split('|')
        let size_weight = details[1]
        let data_split = details[0].trim().split(' ')
        let description = getDescription(data_split)
        let sku = ''
        if (description === 'Trainer') {
          sku = input.SKU.split('|')[1].trim()
          description = 'Trainer'
        } else {
          sku = data_split[data_split.length - 1]
        }

        let sw_spit = size_weight.split('(')
//        log.debug('sw_spit', sw_spit)
        let weight = sw_spit[1].replace(')', '').replace('lbs', '')
//        log.debug('weight', weight)
        let dim_split = sw_spit[0].split(' ')
        let dimensions = dim_split[1]
        let dim_uom = dim_split[2]
        let dimensions_ext = dimensions.split('x')
        let length = dimensions_ext[0]
        let width = dimensions_ext[1]
        let height = dimensions_ext[2]

        accountProduct.sku = sku
        accountProduct.description = description
        outputObj.accountProduct = accountProduct
        outputObj.barcode = `${input.order}-${sku}`
        outputObj.barcodeCreationOption = 'Manual'
        outputObj.freightFulfillmentMode =
          input.freightFulfillmentMode
        outputObj.productReferenceNumber = `${input.order}-${sku}`
        outputObj.Quantity = 1
        outputObj.weight = parseInt(weight)
        outputObj.weightUnitId = 1
        outputObj.dimensions = {}
        outputObj.dimensions.height = height
        outputObj.dimensions.width = width
        outputObj.dimensions.length = length
        outputObj.dimensions.dimUOM = dim_uom
        if (
          input.hubCode === 'XLM-C02' ||
          input.hubCode === 'XLM-A02' ||
          input.hubCode === 'XLM-L02' ||
          input.hubCode === 'XLM-G02'
        )
          delete outputObj.freightFulfillmentMode

        output.push(outputObj)
      })

      return JSON.stringify(output)
    } catch (error) {
      log.debug('error', error)
    }
  }

  const getDescription = (data_split) => {
    let description = ''
    if (
      data_split.includes('Tonal') === true &&
      data_split.includes('Trainer') === true
    ) {
      description = 'Trainer'
    } else {
      for (var i = 0; i < data_split.length - 1; i++) {
        description += data_split[i] + ' '
      }
      description = description.trim()
    }
    return description
  }

  return {
    post: _post,
  }
})
