# GEMINI.md

## Project Overview

This is a Next.js 14 project for a two-sided marketplace connecting service providers with customers. It uses TypeScript, Supabase for the database, and Stripe Connect for payments. The frontend is built with ShadCN and Tailwind CSS.

The project is structured as a monorepo with a clear separation of concerns between the frontend, backend, and database. It includes features like authentication, payments, and a booking system.

## Building and Running

### Prerequisites

*   Node.js >= 18
*   Git
*   Supabase account
*   Clerk account
*   Stripe account
*   Vercel account

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/CodeSpringHQ/codespring-boilerplate.git
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Environment Variables

1.  Copy the example environment file:
    ```bash
    cp .env.example .env.local
    ```
2.  Fill in the required environment variables in `.env.local`.

### Running the Project

*   **Development:**
    ```bash
    npm run dev
    ```
*   **Build:**
    ```bash
    npm run build
    ```
*   **Start:**
    ```bash
    npm run start
    ```
*   **Lint:**
    ```bash
    npm run lint
    ```
*   **Tests:**
    *   Unit tests: `npm test`
    *   E2E tests: `npm run test:e2e`

### Database

The project uses Drizzle ORM for database migrations.

*   **Generate migrations:**
    ```bash
    npm run db:generate
    ```
*   **Run migrations:**
    ```bash
    npm run db:migrate
    ```
*   **Push schema changes:**
    ```bash
    npm run db:push
    ```

## Development Conventions

*   **File Naming:**
    *   Components: `example-component.tsx`
    *   Actions: `example-actions.ts`
*   **Database:**
    *   Schema definitions are located in `db/schema`.
    *   Reusable queries are located in `db/queries`.
*   **API:**
    *   Server-side logic is handled by server actions in the `actions` directory.
*   **Styling:**
    *   The project uses Tailwind CSS and ShadCN UI for styling.
*   **Testing:**
    *   Unit tests are written with Jest and React Testing Library.
    *   End-to-end tests are written with Playwright.
