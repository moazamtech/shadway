# Shadway

<div align="center">
  <img src="/public/logo.png" alt="Shadway Logo" width="120" height="120" />

  <h3>Curated Shadcn UI Component Library & Platform</h3>
  <p>Discover, generate, and publish Shadcn UI components. An open-source platform for UI inspiration and rapid development.</p>

  <img src="/public/og-image.png" alt="Shadway Preview" width="600" />
</div>

## Live Demo

- **Main Platform**: [https://shadway.online/](https://shadway.online/)
- **AI Generator**: [https://shadway.online/component-generator](https://shadway.online/component-generator)
- **Vibecode Gallery**: [https://shadway.online/vibecode](https://shadway.online/vibecode)

---

## Sponsors

<div align="center">
  <a href="https://wrizzai.online/" target="_blank">WrizzAI</a> &nbsp;|&nbsp; <a href="https://down4media.online/" target="_blank">Down4Media</a>
</div>

---

## Why Shadway?

Stop hunting through scattered resources. Instead of wasting hours searching for Shadcn UI components, examples, and templates across different platforms, Shadway brings everything to one place.

### Key Features

- **Component Library** - Curated registry of production-ready Shadcn UI components organized by category
- **AI Generator** - Describe UI in plain English, get production-ready code instantly
- **Vibecode Gallery** - Discover and fork community-built components
- **Templates** - Premium and free website templates
- **Submit** - Share your Shadcn UI projects with the community
- **Dark/Light Mode** - Seamless theme switching
- **Responsive Design** - Works perfectly on all devices

---

## Tech Stack

### Frontend

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first CSS framework
- **Shadcn UI** - High-quality UI components
- **Framer Motion** - Smooth animations
- **Lucide React** - Beautiful icons
- **Sandpack** - Live code preview for component generation

### Backend & Database

- **MongoDB** - NoSQL database
- **NextAuth.js** - Authentication

### Deployment & Tools

- **Vercel** - Hosting platform
- **ESLint** - Code linting
- **Prettier** - Code formatting

---

## Project Structure

```
shadway/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Homepage with component gallery
│   ├── docs/             # Component documentation
│   ├── component-generator/ # AI component generator
│   ├── vibecode/         # Community vibecode gallery
│   ├── template/          # Template marketplace
│   ├── submit/          # Project submission
│   ├── admin/           # Admin dashboard
│   └── api/            # API routes
├── components/            # Reusable components
│   ├── ui/             # Shadcn UI components
│   ├── landing/         # Landing page components
│   └── site-components/ # Custom site components
├── lib/                # Utilities and configs
├── hooks/              # Custom React hooks
└── registry/           # Component registry data
```

---

## Getting Started

### Prerequisites

- Node.js 24+ and npm
- MongoDB database
- Environment variables configured

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/moazamtech/shadway.git
   cd shadway
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Configure your `.env.local`:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser

---

## Platform Overview

### Component Library (`/docs`)

Browse curated registry blocks across multiple categories including:
- Hero sections
- Feature grids
- Call-to-action blocks
- Contact sections
- About sections
- Testimonials
- Footers
- And more...

Each component can be installed with a single command.

### AI Generator (`/component-generator`)

Describe the UI you want to build in plain language. The AI generates production-ready components with:

1. **Prompt** - Describe your UI in natural language
2. **Generate** - Get runnable code and live preview
3. **Edit** - Adjust files directly with Monaco editor
4. **Publish** - Share with the community

### Vibecode Gallery (`/vibecode`)

Discover community-built components. Fork, customize, and ship to production.

### Templates (`/template`)

Browse premium and free website templates built with Shadcn UI.

### Submit (`/submit`)

Share your Shadcn UI project with the community for review and potential featuring.

### Admin Dashboard (`/admin`)

Manage content, user submissions, templates, and view analytics.

---

## Contributing

We welcome contributions:

1. **Submit your project** - Share your Shadcn UI website
2. **Report bugs** - Help us improve
3. **Suggest features** - Share your ideas
4. **Code contributions** - Submit pull requests

### Development Guidelines

- Follow TypeScript best practices
- Use Shadcn UI components when possible
- Maintain responsive design principles
- Write clean, documented code

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Connect

- **Website**: [https://shadway.online/](https://shadway.online/)
- **Twitter**: [@loxtmozzi](https://x.com/loxtmozzi)
- **GitHub**: [https://github.com/moazamtech/shadway](https://github.com/moazamtech/shadway)

---

## Acknowledgments

- [Shadcn](https://twitter.com/shadcn) for the amazing UI components
- [Vercel](https://vercel.com) for hosting
- The Shadcn UI community for inspiration

---

<div align="center">
  <p>Made with care by <a href="https://x.com/loxtmozzi">Moazam Butt</a></p>
  <p>Star this repo if you find it helpful!</p>
</div>