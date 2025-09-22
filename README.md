# Shadway 🎨

<div align="center">
  <img src="/public/logo.png" alt="Shadway Logo" width="120" height="120" />

  <h3>Curated Shadcn UI Website Collection</h3>
  <p>Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration.</p>

  <img src="/public/og-image.png" alt="Shadway Preview" width="600" />
</div>

## 🚀 Why Shadway ?

**Stop hunting through scattered resources!** Instead of wasting hours searching for the latest Shadcn UI libraries, components, and examples across different platforms, **Shadway brings everything to one place**.

### 🎯 Main Focus
- **Discover** the latest UI websites built with Shadcn UI
- **Browse** premium templates and components
- **Showcase** your own Shadcn UI projects
- **Get inspired** by modern interface designs

**No more hassle - just pure inspiration and resources in one curated collection.**

## ✨ Features

- 🏠 **Curated Website Gallery** - Latest websites built with Shadcn UI
- 🎨 **Template Marketplace** - Premium and free templates
- 📝 **Easy Submission** - Submit your own projects
- 💎 **Sponsorship Options** - Promote your work
- 🌙 **Dark/Light Mode** - Seamless theme switching
- 📱 **Responsive Design** - Perfect on all devices
- ⚡ **Fast Performance** - Optimized for speed

## 🛠️ Tech Stack

### Frontend
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Tailwind CSS v4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Shadcn UI](https://ui.shadcn.com/)** - High-quality UI components
- **[Framer Motion](https://www.framer.com/motion/)** - Smooth animations
- **[Lucide React](https://lucide.dev/)** - Beautiful icons

### Backend & Database
- **[MongoDB](https://www.mongodb.com/)** - NoSQL database
- **[NextAuth.js](https://next-auth.js.org/)** - Authentication
- **[bcryptjs](https://github.com/dcodeIO/bcrypt.js)** - Password hashing

### Deployment & Tools
- **[Vercel](https://vercel.com/)** - Hosting platform
- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting

## 🏗️ Project Structure

```
shadway/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin dashboard
│   ├── api/               # API routes
│   ├── sponsor/           # Sponsorship page
│   ├── submit/            # Submission page
│   ├── template/          # Templates page
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/            # Reusable components
│   ├── ui/               # Shadcn UI components
│   ├── navbar.tsx        # Navigation
│   ├── footer.tsx        # Footer
│   └── ...
├── lib/                  # Utilities and configs
│   ├── auth.ts          # Authentication config
│   ├── mongodb.ts       # Database connection
│   ├── types.ts         # TypeScript types
│   └── utils.ts         # Helper functions
└── public/              # Static assets
```

## 🚀 Getting Started

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

## 🎨 Features Overview

### 🏠 Homepage
- Curated collection of Shadcn UI websites
- Filter by categories and features
- Responsive grid layout
- Search functionality

### 🎯 Templates
- Premium and free templates
- Live demo links
- Download/purchase options
- Featured templates

### 📝 Submit Project
- Easy submission form
- Project categorization
- Admin review process
- Community showcase

### 💎 Sponsorship
- Multiple sponsorship tiers
- Enhanced visibility options
- Premium placement
- Analytics tracking

### 🔐 Admin Dashboard
- Content management
- User submissions review
- Analytics and insights
- Template management

## 🌟 Contributing

We welcome contributions! Here's how you can help:

1. **Submit your project** - Share your Shadcn UI website
2. **Report bugs** - Help us improve the platform
3. **Suggest features** - Share your ideas
4. **Code contributions** - Submit pull requests

### Development Guidelines
- Follow TypeScript best practices
- Use Shadcn UI components when possible
- Maintain responsive design principles
- Write clean, documented code

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Connect

- **Website**: [shadway.vercel.app](https://shadway.vercel.app)
- **Twitter**: [@loxtmozzi](https://x.com/loxtmozzi)
- **GitHub**: [Shadway Repository](https://github.com/moazamtech/shadway)

## 🙏 Acknowledgments

- [Shadcn](https://twitter.com/shadcn) for the amazing UI components
- [Vercel](https://vercel.com) for hosting
- The amazing Shadcn UI community for inspiration

---

<div align="center">
  <p>Made with ❤️ by <a href="https://x.com/loxtmozzi">Moazam Butt</a></p>
  <p>⭐ Star this repo if you find it helpful!</p>
</div>