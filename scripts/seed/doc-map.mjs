// Which ticket file fills which document slot(s). Paths are relative to the tickets folder.
// One file can fill several slots (e.g. the Atlys PDF has all 5 e-visas + 5 insurance certificates).
export const docMap = {
  'vietnam-2026': [
    { file: 'Vietnam Visa.pdf', slots: ['visa-*', 'ins-*'] },
    { file: 'Flipkart Flight E-Ticket.pdf', slots: ['tkt-ob5l6j'] },
    { file: 'AA08E4C0376F00022E2F0C000_260911_080203.pdf', slots: ['tkt-gi2egr'] },
    { file: 'E-itinerary_260918_074325.pdf', slots: ['tkt-vietjet-dom'] },
    { file: 'Flipkart Flight E-Ticket (1).pdf', slots: ['tkt-58ftfj'] },
    { file: 'WhatsApp Image 2026-10-11 at 11.45.26 AM.jpeg', slots: ['tkt-z67lgs'] },
    { file: 'Booking.com_ Confirmation.pdf', slots: ['htl-delicate-1'] },
    { file: 'Booking.com_ Confirmation-2.pdf', slots: ['htl-delicate-2'] },
    { file: 'Confirmation_for_Booking_ID_#_2052041833.pdf', slots: ['htl-urban-1'] },
    { file: 'Confirmation_for_Booking_ID_#_2052042959.pdf', slots: ['htl-urban-2'] },
    { file: 'Receipt_NRJ724054_20260928.pdf', slots: ['act-cozybay'] },
  ],
};
