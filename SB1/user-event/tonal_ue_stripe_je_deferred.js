/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 */
define(['N/search', 'N/record', 'N/runtime'], function (
  search,
  record,
  runtime,
) {
  const afterSubmit = (context) => {
    const depositRecord = context.newRecord
    const testRun = depositRecord.getValue({ fieldId: 'custbody7' })
    if (
      runtime.executionContext ===
        runtime.ContextType.USER_INTERFACE &&
      testRun === true
    ) {
      const depositDate = depositRecord.getValue({
        fieldId: 'trandate',
      })
      const memo = depositRecord.getValue({ fieldId: 'memo' })

      const payments = extractPaymentDetails(depositRecord)
      const transactionTypes = paymentTypes(payments)
      const paymentTotals = computePaymentTotals(
        payments,
        transactionTypes,
      )

      const cashBackPayments = extractCashBackDetails(depositRecord)
      const cashBackTotals = computeCashbackTotals(cashBackPayments)

      const totalNumberOfPayments = paymentTotals.reduce(
        (acc, payment) => acc + payment.numberOfRecords,
        0,
      )
      let stripeFee = (1 / totalNumberOfPayments) * cashBackTotals
      log.debug('Stripe Fee', stripeFee)

      let customerDeposits = paymentTotals.filter(
        (payment) => payment.type === 'CustDep',
      )

      generateStripeJE(customerDeposits, stripeFee, depositDate, memo)

      log.debug('customerDeposits', customerDeposits)
      // log.debug('Payment Totals', paymentTotals)
      log.debug('Cash Back Totals', cashBackTotals)
    }
  }

  const extractPaymentDetails = (depositRecord) => {
    const payments = []

    let depositRec = record.load({
      type: record.Type.DEPOSIT,
      id: depositRecord.id,
      isDynamic: true,
    })

    let lineCount = depositRec.getLineCount({
      sublistId: 'payment',
    })
    for (var i = 0; i < lineCount; i += 1) {
      let isApplied = depositRec.getSublistValue({
        sublistId: 'payment',
        fieldId: 'deposit',
        line: i,
      })

      if (isApplied === true) {
        let payment = {
          line: i,
          type: depositRec.getSublistValue({
            sublistId: 'payment',
            fieldId: 'type',
            line: i,
          }),
          amount: parseFloat(
            depositRec.getSublistValue({
              sublistId: 'payment',
              fieldId: 'paymentamount',
              line: i,
            }),
          ),
          id: depositRec.getSublistValue({
            sublistId: 'payment',
            fieldId: 'id',
            line: i,
          }),
        }
        payments.push(payment)
      }
    }

    return payments
  }

  const extractCashBackDetails = (depositRecord) => {
    const payments = []

    const depositRec = record.load({
      type: record.Type.DEPOSIT,
      id: depositRecord.id,
      isDynamic: true,
    })

    const lineCount = depositRec.getLineCount({
      sublistId: 'cashback',
    })
    for (let i = 0; i < lineCount; i++) {
      let cb = {
        line: depositRec.getSublistValue({
          sublistId: 'cashback',
          fieldId: 'line',
          line: i,
        }),
        amount: depositRec.getSublistValue({
          sublistId: 'cashback',
          fieldId: 'amount',
          line: i,
        }),
      }

      payments.push(cb)
    }

    return payments
  }

  const paymentTypes = (payments) => {
    const transactionTypes = []

    // grabbing unique payments types
    const types = new Set()
    for (const payment of payments) {
      types.add(payment.type)
    }

    // extracting payment types
    types.forEach((type) => transactionTypes.push(type))

    return transactionTypes
  }

  const computePaymentTotals = (payments, transactionTypes) => {
    const amounts = []
    for (var i = 0; i < transactionTypes.length; i++) {
      let payment = {
        type: transactionTypes[i],
        numberOfRecords: payments.filter(
          (deposits) => deposits.type === transactionTypes[i],
        ).length,
        amount: payments
          .filter((deposits) => deposits.type === transactionTypes[i])
          .reduce((acc, deposit) => acc + deposit.amount, 0),
        details: payments.filter(
          (deposits) => deposits.type === transactionTypes[i],
        ),
      }
      amounts.push(payment)
    }

    return amounts
  }

  const computeCashbackTotals = (cashBackPayments) => {
    return cashBackPayments.reduce(
      (acc, cashback) => acc + cashback.amount,
      0,
    )
  }

  const generateStripeJE = (
    customerDeposits,
    stripeFee,
    depositDate,
    memo,
  ) => {
    let data = customerDeposits[0].details
    data.forEach((payment) => {
      let debitAccount = '906'
      let creditAccount = '252'

      let journalRecord = record.create({
        type: record.Type.JOURNAL_ENTRY,
        isDynamic: true,
      })

      journalRecord.setValue({
        fieldId: 'trandate',
        value: depositDate,
      })

      journalRecord.setValue({ fieldId: 'approvalstatus', value: 2 })
      journalRecord.setValue({ fieldId: 'subsidiary', value: 1 })
      journalRecord.setValue({ fieldId: 'memo', value: memo })
      journalRecord.insertLine({ sublistId: 'line', line: 0 })
      journalRecord.setCurrentSublistValue({
        sublistId: 'line',
        fieldId: 'account',
        value: debitAccount,
      })
      journalRecord.setCurrentSublistValue({
        sublistId: 'line',
        fieldId: 'debit',
        value: stripeFee,
      })
      journalRecord.commitLine({ sublistId: 'line' })
      journalRecord.insertLine({ sublistId: 'line', line: 1 })
      journalRecord.setCurrentSublistValue({
        sublistId: 'line',
        fieldId: 'account',
        value: creditAccount,
      })
      journalRecord.setCurrentSublistValue({
        sublistId: 'line',
        fieldId: 'credit',
        value: stripeFee,
      })
      journalRecord.commitLine({ sublistId: 'line' })

      let journalId = journalRecord.save()

      let customerDeposit = record.load({
        type: record.Type.CUSTOMER_DEPOSIT,
        id: payment.id,
      })
      customerDeposit.setValue({
        fieldId: 'custbody_payment_fee',
        value: stripeFee,
      })
      customerDeposit.setValue({
        fieldId: 'custbody_merchant_fee_je_1',
        value: journalId,
      })
      customerDeposit.save()

      log.debug('Journal ID', journalId)
      log.debug('Customer ID', customerDeposit)
    })
  }

  return {
    afterSubmit: afterSubmit,
  }
})
