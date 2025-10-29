# Shadway Registry

Custom component registry for Shadway UI components. This registry allows users to download and use Shadway components in their projects via the Shadcn CLI.

## Available Components

### Mesh Background
- **Type**: Layout / Background
- **Category**: Visual Effects
- **Description**: An animated mesh gradient background component built with WebGL shaders
- **Dependencies**: `@paper-design/shaders-react`
- **Status**: Published ✅

### Footer Block
- **Type**: Layout / Footer Block
- **Category**: Footer
- **Description**: A beautifully designed footer block with multiple columns, decorative borders, and responsive layout
- **Dependencies**: `lucide-react`, `next`
- **Status**: Published ✅

## Registry Structure

```
registry/
├── index.json                  # Master registry index (all components)
├── mesh-background.json        # Component definition
├── README.md                   # This file
└── (future components...)
```

## Adding New Components

To add a new component to the registry:

1. Create the component file in `components/ui/`
2. Create a `.json` file in `registry/` with the component metadata
3. Update `registry/index.json` with the new component entry
4. Update this README with component information
5. Push to GitHub for public availability

### Component JSON Format

```json
{
  "name": "component-name",
  "type": "component:ui",
  "registryDependencies": [],
  "files": [
    {
      "path": "components/ui/component-name.tsx",
      "type": "component",
      "target": ""
    }
  ],
  "category": "category-name",
  "subcategory": "subcategory",
  "shortDescription": "Short description",
  "description": "Longer description of the component",
  "links": {
    "doc": "https://shadway.online/docs/components/component-name",
    "source": "https://github.com/moazamtech/shadway"
  },
  "isFavorited": false,
  "published": true
}
```

## Installation Instructions

### For Users

#### Install Individual Component

**Mesh Background:**
```bash
npx shadcn-ui@latest add https://shadway.online/registry/mesh-background.json
```

**Footer Block:**
```bash
npx shadcn-ui@latest add https://shadway.online/registry/footer-block.json
```

### For Developers

To set up the registry locally:

1. Clone the repository
```bash
git clone https://github.com/moazamtech/shadway.git
cd shadway
```

2. Install dependencies
```bash
npm install
```

3. Run development server
```bash
npm run dev
```

4. View registry at `http://localhost:3000/registry`

## Component Requirements

All components in the Shadway registry should:

- ✅ Be built with React and TypeScript
- ✅ Use Tailwind CSS for styling
- ✅ Export proper TypeScript types
- ✅ Include comprehensive JSDoc comments
- ✅ Be fully accessible (WCAG 2.1 AA)
- ✅ Support dark mode
- ✅ Include usage examples
- ✅ Have proper error handling
- ✅ Be optimized for performance

## Documentation Standards

Each component should include:

1. **Props Documentation**: Full TypeScript interface with JSDoc comments
2. **Usage Examples**: Multiple examples showing different use cases
3. **API Documentation**: Detailed explanation of all props and their ranges
4. **Accessibility Notes**: ARIA labels, keyboard support, etc.
5. **Performance Tips**: Best practices for optimal performance
6. **Browser Support**: Minimum version requirements

## Publishing to Registry

To publish a new component version:

1. Update version in component's JSDoc
2. Update `registry/index.json`
3. Create/update `.json` file in `registry/`
4. Commit and push changes
5. Create a GitHub release with component details
6. Update documentation website

## Registry API

The registry provides a simple JSON API:

### Get All Components
```
GET /registry/index.json
```

### Get Specific Component
```
GET /registry/[component-name].json
```

## Support

- **Documentation**: https://shadway.online/docs
- **GitHub Issues**: https://github.com/moazamtech/shadway/issues
- **Discussions**: https://github.com/moazamtech/shadway/discussions

## License

All components in the Shadway registry are licensed under the MIT License.
