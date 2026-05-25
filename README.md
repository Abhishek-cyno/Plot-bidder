# Plot Bid Logger

Simple HTML, CSS, JavaScript, Node.js, Express, and MongoDB project for tracking plot bid entries and edit logs.

## Features

- Add plot ID, details, and bid amount.
- Pick a fixed user ID from a dropdown. No login system is used.
- Edit existing table entries.
- Each create or edit updates the row log time and user.
- Each create or edit is saved in an audit log showing who changed which field.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from `.env.example`.

   ```bash
   copy .env.example .env
   ```

3. Make sure MongoDB is running locally, or replace `MONGODB_URI` in `.env` with your MongoDB Atlas connection string.

4. Start the app:

   ```bash
   npm start
   ```

5. Open:

   ```text
   http://localhost:3000
   ```

## Fixed Users

The users are currently defined in `server.js`:

- `USR001 - Amit`
- `USR002 - Priya`
- `USR003 - Rahul`
- `USR004 - Neha`

Change those names or IDs in the `USERS` array if needed.
