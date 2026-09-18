// =======================================================
// Ja-Ela Serenity Villa
// Global Application Configuration
// =======================================================

const CONFIG = {

    // =====================================
    // Villa Information
    // =====================================

    villa: {

        name: "Ja-Ela Serenity Villa",

        address: "871 St Rita Avenue, Ja-Ela, Sri Lanka",

        maxGuests: 9

    },

    // =====================================
    // Pricing
    // =====================================

    pricing: {

        currency: "AUD",

        nightlyRate: 60,

        cleaningFee: 6,

        extraGuestRate: 5.5

    },

    // =====================================
    // Payment
    // =====================================

    payment: {

        depositPercentage: 30,

        balanceDueHoursBeforeCheckin: 168,

	    balanceGracePeriodHours: 48,

        cancellationFeePercentage: 30

    },

    // =====================================
    // Firestore
    // =====================================

    firestore: {

        bookingsCollection: "bookings",
        categoriesCollection: "categories",
        expensesCollection: "expenses",
        utilityBillsCollection: "utilityBills"

    },

    // =====================================
    // Booking Status
    // =====================================

    bookingStatus: {

        pending: "Pending",

        confirmed: "Confirmed",

        cancelled: "Cancelled"

    },

    // =====================================
    // Contact Information
    // =====================================

    contact: {

        phone: "+61 451 979 456",

        whatsapp: "+61 451 979 456",

        email: "info@jaelaserenityvilla.com"

    }

};
