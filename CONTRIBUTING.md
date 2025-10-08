# Contributing to Shadway

Thank you for your interest in contributing to Shadway! We welcome contributions from the community to help make this the best collection of Shadcn UI websites and components.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Submitting a Website](#submitting-a-website)
- [Development Guidelines](#development-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone. Please be kind and courteous in all interactions.

## Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/moazamtech/shadway.git
   cd shadway
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   MONGODB_URI=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## How to Contribute

There are several ways you can contribute to Shadway:

### 1. Submit a Website
If you've found or built a website using Shadcn UI, you can submit it through:
- **Website Submission Form**: Visit [shadway.com/submit](https://shadway.com/submit)
- **Pull Request**: Add the website directly to the database (see below)

### 2. Report Issues
Found a bug or have a suggestion? [Open an issue](https://github.com/moazamtech/shadway/issues/new)

### 3. Improve Documentation
Help improve our docs, add examples, or clarify existing content

### 4. Code Contributions
Fix bugs, add features, or improve performance

## Submitting a Website

### Via Website Form (Recommended)
1. Visit [shadway.com/submit](https://shadway.com/submit)
2. Fill in the website details
3. Submit for review

### Via Pull Request
If you prefer to submit via PR:

1. Add the website data to your local MongoDB instance
2. Test that it displays correctly
3. Take screenshots showing the website card
4. Create a pull request with:
   - Website name, URL, description, category
   - Screenshot of the preview
   - Why it should be included

**Website Submission Criteria:**
- Must use Shadcn UI components
- Must be live and accessible
- Must have a clear purpose/use case
- Must be well-designed and functional
- Original content (not a copy of another site)

## Development Guidelines

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + Shadcn UI
- **Database**: MongoDB
- **Authentication**: NextAuth.js
- **Animations**: Framer Motion

### Code Style
- Use TypeScript for type safety
- Follow the existing code structure
- Use functional components with hooks
- Keep components small and focused
- Add comments for complex logic
- Use meaningful variable/function names

### Folder Structure
```
shadway/
├── app/                  # Next.js app router pages
├── components/           # React components
│   ├── ui/              # Shadcn UI components
│   └── ...              # Custom components
├── lib/                 # Utility functions
│   ├── types.ts         # TypeScript types
│   ├── mongodb.ts       # Database connection
│   └── utils/           # Helper functions
└── public/              # Static assets
```

### Component Guidelines
- Use client components only when necessary (`"use client"`)
- Implement proper loading states
- Add error boundaries where appropriate
- Ensure responsive design (mobile-first)
- Use semantic HTML
- Optimize images with Next.js Image component

### Styling Guidelines
- Use Tailwind CSS utility classes
- Follow the existing design system
- Maintain dark/light mode compatibility
- Use CSS variables for theming
- Ensure accessibility (WCAG 2.1 AA)

## Pull Request Process

1. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Test thoroughly
   - Ensure no layout shifts or visual bugs

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   **Commit Message Format:**
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `style:` - Code style changes (formatting)
   - `refactor:` - Code refactoring
   - `perf:` - Performance improvements
   - `test:` - Adding tests
   - `chore:` - Maintenance tasks

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**
   - Go to [github.com/moazamtech/shadway](https://github.com/moazamtech/shadway)
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template
   - Add screenshots/videos if UI changes
   - Link any related issues

### PR Checklist
- [ ] Code follows the project's style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] No console errors or warnings
- [ ] Responsive design tested (mobile, tablet, desktop)
- [ ] Dark/light mode tested
- [ ] No layout shift (CLS = 0)
- [ ] Images optimized
- [ ] Accessibility checked

## Reporting Bugs

When reporting bugs, please include:

1. **Bug Description**: Clear description of the issue
2. **Steps to Reproduce**: Detailed steps to reproduce the bug
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Screenshots**: If applicable
6. **Environment**:
   - Browser & version
   - OS & version
   - Device (if mobile)
7. **Additional Context**: Any other relevant information

**Example:**
```markdown
**Bug**: Images not loading on website cards

**Steps to Reproduce**:
1. Go to homepage
2. Scroll to website cards section
3. Notice images showing as broken

**Expected**: Images should load
**Actual**: Broken image icons appear

**Environment**:
- Browser: Chrome 120
- OS: Windows 11
- Device: Desktop

**Screenshot**: [attach screenshot]
```

## Feature Requests

We welcome feature suggestions! When requesting features:

1. **Search existing issues** to avoid duplicates
2. **Describe the feature** clearly and concisely
3. **Explain the use case** - why is this needed?
4. **Provide examples** - mockups, similar implementations
5. **Consider impact** - how does this benefit users?

## Questions?

If you have questions about contributing:
- Check existing [Issues](https://github.com/moazamtech/shadway/issues)
- Open a [Discussion](https://github.com/moazamtech/shadway/discussions)
- Reach out on [Twitter/X](https://twitter.com/moazamtech)

## Recognition

Contributors will be recognized in:
- GitHub contributors page
- Project README
- Release notes (for significant contributions)

## License

By contributing to Shadway, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to Shadway! 🎉**

Together, we're building the best collection of Shadcn UI websites and components.
