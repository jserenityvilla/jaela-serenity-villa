"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const utilitySource = fs.readFileSync(
    path.join(__dirname, "..", "admin", "accounts", "accounts-profitability-utils.js"),
    "utf8"
);

const browserWindow = {};
new Function("window", utilitySource)(browserWindow);

const utils = browserWindow.AccountsProfitabilityUtils;
const date = value => new Date(value + "T00:00:00");

const periodFrom = date("2026-01-01");
const periodTo = date("2026-01-03");

const booking = {
    id: "B-100",
    bookingReference: "B-100",
    status: "Confirmed",
    checkin: "2026-01-01",
    checkout: "2026-01-03",
    nights: 2,
    totalGuests: 2,
    adults: 2,
    children: 0,
    currency: "AUD",
    exchangeRateToLkr: 200,
    accommodation: 200,
    extraGuestFee: 0,
    cleaningFee: 20
};

test("AUD booking revenue is converted to LKR", () => {
    assert.equal(
        utils.bookingRevenue(booking, periodFrom, periodTo),
        44000
    );
});

test("LKR booking revenue is used without an exchange rate", () => {
    assert.equal(
        utils.bookingRevenue({
            ...booking,
            currency: "LKR",
            exchangeRateToLkr: null
        }, periodFrom, periodTo),
        220
    );
});

test("USD booking revenue uses its stored LKR exchange rate", () => {
    assert.equal(
        utils.bookingRevenue({
            ...booking,
            currency: "USD",
            exchangeRateToLkr: 300
        }, periodFrom, periodTo),
        66000
    );
});

test("cleaning revenue is recognised on the checkout date", () => {
    assert.equal(
        utils.bookingRevenue(
            booking,
            date("2026-01-03"),
            date("2026-01-03")
        ),
        4000
    );
});

test("expense totals use LKR amounts and only include active in-period expenses", () => {
    const expenses = [
        {
            id: "E-001",
            status: "Active",
            expenseDate: "2026-01-02",
            expenseType: "Cleaning",
            amount: 20,
            currency: "AUD",
            exchangeRateToLkr: 200,
            amountLkr: 4000
        },
        {
            id: "E-002",
            status: "Active",
            expenseDate: "2026-01-05",
            expenseType: "Maintenance",
            amount: 500,
            currency: "LKR"
        },
        {
            id: "E-003",
            status: "Cancelled",
            expenseDate: "2026-01-02",
            expenseType: "Other",
            amount: 900,
            currency: "LKR"
        }
    ];

    assert.equal(
        utils.expenseTotal(expenses, periodFrom, periodTo),
        4000
    );

    assert.deepEqual(
        { ...utils.expenseBreakdown(expenses, periodFrom, periodTo) },
        { Cleaning: 4000 }
    );
});

test("AUD expense can use its stored exchange rate when amountLkr is absent", () => {
    assert.equal(
        utils.getRecordLkrAmount({
            id: "E-004",
            amount: 15,
            currency: "AUD",
            exchangeRateToLkr: 200
        }, "Expense"),
        3000
    );
});

test("AUD expense without an LKR equivalent or exchange rate is rejected", () => {
    assert.throws(
        () => utils.getRecordLkrAmount({
            id: "E-005",
            amount: 12,
            currency: "AUD"
        }, "Expense"),
        /no stored LKR amount or valid exchange rate/i
    );
});

test("property utility bills without billing-period dates retain bill-date fallback", () => {
    const bills = [
        {
            id: "U-001",
            status: "Active",
            billDate: "2026-01-02",
            allocationMethod: "None",
            amount: 10,
            currency: "AUD",
            exchangeRateToLkr: 200,
            amountLkr: 2000
        },
        {
            id: "U-002",
            status: "Active",
            billDate: "2026-01-05",
            allocationMethod: "None",
            amount: 700,
            currency: "LKR"
        }
    ];

    assert.equal(
        utils.utilityTotal(bills, [booking], periodFrom, periodTo),
        2000
    );
});

test("property utility bills are prorated across inclusive billing-period days", () => {
    const bill = {
        id: "U-BILL-PERIOD",
        status: "Active",
        billDate: "2026-01-05",
        billingPeriodFrom: "2026-01-02",
        billingPeriodTo: "2026-01-05",
        allocationMethod: "None",
        amount: 4000,
        currency: "LKR"
    };

    const firstPeriod = utils.utilityTotal(
        [bill],
        [],
        date("2026-01-01"),
        date("2026-01-03")
    );

    const secondPeriod = utils.utilityTotal(
        [bill],
        [],
        date("2026-01-04"),
        date("2026-01-05")
    );

    assert.equal(firstPeriod, 2000);
    assert.equal(secondPeriod, 2000);
    assert.equal(firstPeriod + secondPeriod, 4000);
});

test("occupied-night utility is allocated to the reporting-period slice", () => {
    const bills = [{
        id: "U-003",
        status: "Active",
        allocationMethod: "Occupied Nights",
        billingPeriodFrom: "2026-01-01",
        billingPeriodTo: "2026-01-02",
        amount: 2000,
        currency: "LKR"
    }];

    assert.equal(
        utils.utilityTotal(
            bills,
            [booking],
            date("2026-01-01"),
            date("2026-01-01")
        ),
        1000
    );
});

test("direct-booking utility is recognised once on checkout date", () => {
    const bills = [{
        id: "U-004",
        status: "Active",
        allocationMethod: "Direct Booking",
        bookingId: "B-100",
        billDate: "2026-01-03",
        amount: 3000,
        currency: "LKR"
    }];

    assert.equal(
        utils.utilityTotal(bills, [booking], periodFrom, periodTo),
        3000
    );

    assert.equal(
        utils.utilityTotal(
            bills,
            [booking],
            date("2026-01-04"),
            date("2026-01-05")
        ),
        0
    );
});

test("complete profitability calculation returns consistent LKR totals", () => {
    const expenses = [
        {
            id: "E-101",
            status: "Active",
            expenseDate: "2026-01-02",
            expenseType: "Cleaning",
            amount: 20,
            currency: "AUD",
            exchangeRateToLkr: 200,
            amountLkr: 4000
        },
        {
            id: "E-102",
            status: "Active",
            expenseDate: "2026-01-05",
            expenseType: "Out of period",
            amount: 500,
            currency: "LKR"
        }
    ];

    const bills = [
        {
            id: "U-101",
            status: "Active",
            billDate: "2026-01-02",
            allocationMethod: "None",
            amount: 10,
            currency: "AUD",
            exchangeRateToLkr: 200,
            amountLkr: 2000
        },
        {
            id: "U-102",
            status: "Active",
            billDate: "2026-01-05",
            allocationMethod: "None",
            amount: 700,
            currency: "LKR"
        },
        {
            id: "U-103",
            status: "Active",
            billDate: "2026-01-02",
            allocationMethod: "Occupied Nights",
            billingPeriodFrom: "2026-01-01",
            billingPeriodTo: "2026-01-02",
            amount: 2000,
            currency: "LKR"
        },
        {
            id: "U-104",
            status: "Active",
            billDate: "2026-01-03",
            allocationMethod: "Direct Booking",
            bookingId: "B-100",
            amount: 3000,
            currency: "LKR"
        }
    ];

    const result = utils.calculateProfitability({
        bookings: [booking],
        expenses,
        utilityBills: bills,
        periodFrom,
        periodTo
    });

    assert.equal(result.revenue, 44000);
    assert.equal(result.expenses, 4000);
    assert.equal(result.utilities, 7000);
    assert.equal(result.netProfit, 33000);
    assert.equal(result.bookedNights, 2);
    assert.equal(result.calendarNights, 3);
});

test("confirmed booking and guest metrics include only stays overlapping the selected period", () => {
    const outsideBooking = {
        ...booking,
        id: "B-OUTSIDE",
        bookingReference: "B-OUTSIDE",
        checkin: "2026-02-01",
        checkout: "2026-02-03",
        nights: 2,
        totalGuests: 4,
        adults: 4,
        children: 0
    };

    const result = utils.calculateProfitability({
        bookings: [booking, outsideBooking],
        expenses: [],
        utilityBills: [],
        periodFrom,
        periodTo
    });

    assert.equal(result.confirmedBookings, 1);
    assert.equal(result.totalGuests, 2);
    assert.equal(result.guestNights, 4);
    assert.equal(result.revenue, 44000);
});

test("out-of-period AUD records do not block the current report", () => {
    const outsideBooking = {
        id: "B-OUT",
        status: "Confirmed",
        checkin: "2026-02-01",
        checkout: "2026-02-03",
        nights: 2,
        currency: "AUD",
        accommodation: 100,
        extraGuestFee: 0,
        cleaningFee: 10
    };

    const outsideBill = {
        id: "U-OUT",
        status: "Active",
        allocationMethod: "None",
        billDate: "2026-02-01",
        amount: 10,
        currency: "AUD"
    };

    assert.equal(
        utils.bookingRevenue(outsideBooking, periodFrom, periodTo),
        0
    );
    assert.equal(
        utils.utilityTotal([outsideBill], [booking], periodFrom, periodTo),
        0
    );
});
