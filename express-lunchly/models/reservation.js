const db = require("../db");
const moment = require("moment");

class Reservation {
  constructor({ id, customerId, numGuests, startAt, notes }) {
    this.id = id;
    this.customerId = customerId;
    this.numGuests = numGuests;
    this.startAt = startAt;
    this.notes = notes;
  }

  setNumGuests(numGuests) {
    if (numGuests < 1) {
      throw new Error("Number of guests must be at least 1.");
    }
    this.numGuests = numGuests;
  }

  validateStartAt() {
    if (!moment(this.startAt).isValid()) {
      throw new Error("Invalid start date.");
    }
  }

  getformattedStartAt() {
    return moment(this.startAt).format('MMMM Do YYYY, h:mm a');
  }

  static async getReservationsForCustomer(customerId) {
    try {
      const results = await db.query(
        `SELECT id, 
          customer_id AS "customerId", 
          num_guests AS "numGuests", 
          start_at AS "startAt", 
          notes AS "notes"
        FROM reservations 
        WHERE customer_id = $1`,
        [customerId]
      );

      return results.rows.map(row => new Reservation(row));
    } catch (err) {
      console.error(err);
      throw new Error('An error occurred while fetching reservations.');
    }
  }

  async save() {
    this.validateStartAt(); // Ensure the startAt date is valid
    this.setNumGuests(this.numGuests); // Re-validate number of guests, in case it was directly modified

    try {
      if (this.id === undefined) {
        // Insert a new reservation if id is undefined
        const result = await db.query(
          `INSERT INTO reservations (customer_id, num_guests, start_at, notes)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [this.customerId, this.numGuests, this.startAt, this.notes]
        );
        this.id = result.rows[0].id; // Set the id of the reservation with the returned value
      } else {
        // Update existing reservation if id exists
        await db.query(
          `UPDATE reservations
           SET customer_id = $1, num_guests = $2, start_at = $3, notes = $4
           WHERE id = $5`,
          [this.customerId, this.numGuests, this.startAt, this.notes, this.id]
        );
      }
    } catch (err) {
      console.error(err);
      throw new Error('An error occurred while saving the reservation.');
    }
  }
}

module.exports = Reservation;
