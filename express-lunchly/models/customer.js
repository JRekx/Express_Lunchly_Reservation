const db = require("../db");
const Reservation = require("./reservation");

/** Customer of the restaurant. */
class Customer {
  constructor({ id, firstName, lastName, phone, notes }) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.phone = phone;
    this.notes = notes;
  }

  /** Returns the full name of the customer. */
  fullName() {
    return `${this.firstName} ${this.lastName}`;
  }

  /** Validates customer data. */
  validate() {
    if (!this.firstName || !this.lastName) {
      throw new Error("First name and last name are required.");
    }
    // Add additional validations as necessary
  }

  /** Find all customers. */
  static async all() {
    const results = await db.query(
      `SELECT id, 
         first_name AS "firstName",  
         last_name AS "lastName", 
         phone, 
         notes
       FROM customers
       ORDER BY last_name, first_name`
    );
    return results.rows.map(c => new Customer(c));
  }

  /** Search for a customer by name. */
  static async search(name) {
    const results = await db.query(
      `SELECT id, first_name AS "firstName", last_name AS "lastName", phone, notes
       FROM customers
       WHERE first_name ILIKE $1 OR last_name ILIKE $1`,
      [`%${name}%`]
    );
    return results.rows.map(row => new Customer(row));
  }

  /** Find top 10 customers with the most reservations. */
  static async findBestCustomers() {
    const results = await db.query(
      `SELECT c.id, c.first_name AS "firstName", c.last_name AS "lastName", COUNT(r.id) AS reservation_count
       FROM customers c
       JOIN reservations r ON c.id = r.customer_id
       GROUP BY c.id
       ORDER BY reservation_count DESC
       LIMIT 10`
    );
    return results.rows.map(row => new Customer(row));
  }

  /** Get a customer by ID. */
  static async get(id) {
    try {
      const results = await db.query(
        `SELECT id, 
           first_name AS "firstName",  
           last_name AS "lastName", 
           phone, 
           notes 
         FROM customers WHERE id = $1`,
        [id]
      );

      const customer = results.rows[0];
      if (!customer) {
        throw new Error(`No such customer: ${id}`);
      }
      return new Customer(customer);
    } catch (err) {
      console.error(err);
      throw new Error('An error occurred while fetching the customer.');
    }
  }

  /** Get all reservations for this customer. */
  async getReservations() {
    return await Reservation.getReservationsForCustomer(this.id);
  }

  /** Save this customer. */
  async save() {
    this.validate(); // Validate customer details first

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      if (this.id === undefined) {
        const duplicateCheck = await client.query(
          `SELECT id FROM customers WHERE phone = $1`,
          [this.phone]
        );

        if (duplicateCheck.rows.length > 0) {
          throw new Error("A customer with this phone number already exists.");
        }

        const result = await client.query(
          `INSERT INTO customers (first_name, last_name, phone, notes)
               VALUES ($1, $2, $3, $4)
               RETURNING id`,
          [this.firstName, this.lastName, this.phone, this.notes]
        );
        this.id = result.rows[0].id;
      } else {
        await client.query(
          `UPDATE customers SET first_name=$1, last_name=$2, phone=$3, notes=$4
               WHERE id=$5`,
          [this.firstName, this.lastName, this.phone, this.notes, this.id]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
}

module.exports = Customer;
