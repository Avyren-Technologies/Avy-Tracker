# Development Standards & Best Practices

## Code Organization

### File Structure Standards
- **Frontend**: Follow Expo Router file-based routing conventions
- **Backend**: Organize by feature modules (routes, controllers, services, models)
- **Shared Types**: Define interfaces in dedicated `types` directories
- **Components**: Create reusable components in dedicated folders
- **Utils**: Place utility functions in `utils` directories

### Naming Conventions
- **Files**: Use kebab-case for file names (`user-management.tsx`)
- **Components**: Use PascalCase (`UserManagement`)
- **Variables/Functions**: Use camelCase (`getUserData`)
- **Constants**: Use UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Database**: Use snake_case for tables and columns (`user_id`, `created_at`)

## TypeScript Standards

### Type Definitions
```typescript
// Always define interfaces for data structures
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company_id?: string;
}

// Use union types for role-based access
type UserRole = "employee" | "group-admin" | "management" | "super-admin";

// Define API response types
interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
```

### Error Handling
- Always use try-catch blocks for async operations
- Define custom error types for different scenarios
- Provide meaningful error messages to users
- Log detailed errors for debugging

### Database Operations
- Always use parameterized queries to prevent SQL injection
- Use database transactions for multi-step operations
- Handle connection cleanup in finally blocks
- Implement proper error handling for database operations

## Authentication & Security

### JWT Token Management
- **Access Tokens**: 7-day expiry for user sessions
- **Refresh Tokens**: 30-day expiry for token renewal
- **Token Storage**: Use Expo SecureStore for sensitive data
- **Token Validation**: Verify token signature and expiry on each request

### Role-Based Access Control
```typescript
// Middleware for role verification
const requireRole = (allowedRoles: UserRole[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
};
```

### Data Validation
- Validate all input data on both client and server
- Use proper sanitization for user inputs
- Implement rate limiting for API endpoints
- Validate file uploads (type, size, content)

## Database Standards

### Schema Design
- Use consistent naming conventions (snake_case)
- Include `created_at` and `updated_at` timestamps
- Implement proper foreign key relationships
- Use appropriate data types for each field

### Query Optimization
- Use indexes for frequently queried columns
- Implement pagination for large datasets
- Use connection pooling for database connections
- Monitor query performance and optimize slow queries

### Migration Management
- Create migration files for schema changes
- Include rollback procedures for migrations
- Test migrations on staging before production
- Document schema changes and their purpose

## API Design Standards

### RESTful Endpoints
```typescript
// Follow REST conventions
GET    /api/users           // Get all users
GET    /api/users/:id       // Get specific user
POST   /api/users           // Create new user
PUT    /api/users/:id       // Update user
DELETE /api/users/:id       // Delete user
```

### Response Format
```typescript
// Consistent response structure
{
  "data": { /* response data */ },
  "message": "Operation successful",
  "timestamp": "2024-01-01T00:00:00Z"
}

// Error response structure
{
  "error": "Error message",
  "details": "Detailed error information",
  "code": "ERROR_CODE"
}
```

### Status Codes
- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **500**: Internal Server Error

## Frontend Standards

### Component Structure
```typescript
// Component template
interface Props {
  // Define prop types
}

export default function ComponentName({ prop1, prop2 }: Props) {
  // State management
  const [state, setState] = useState();
  
  // Effects
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  // Event handlers
  const handleEvent = () => {
    // Handle events
  };
  
  // Render
  return (
    <View>
      {/* Component JSX */}
    </View>
  );
}
```

### State Management
- Use Zustand for global state management
- Keep component state local when possible
- Implement proper state updates (immutable)
- Use context for theme and authentication

### Styling Standards
- Use NativeWind (Tailwind CSS) for consistent styling
- Define color schemes in theme context
- Support both light and dark themes
- Use responsive design principles

## Location & Tracking Standards

### GPS Tracking
- Request appropriate location permissions
- Handle permission denials gracefully
- Implement battery optimization strategies
- Use background location tasks for continuous tracking

### Geofencing
- Define clear geofence boundaries
- Handle entry/exit events properly
- Store geofence data in PostGIS format
- Implement geofence validation logic

### Data Privacy
- Only collect necessary location data
- Implement data retention policies
- Provide user controls for location sharing
- Comply with privacy regulations

## Testing Standards

### Unit Testing
- Write tests for utility functions
- Test component rendering and behavior
- Mock external dependencies
- Achieve good test coverage

### Integration Testing
- Test API endpoints with real database
- Test authentication flows
- Test file upload functionality
- Test real-time features

### Performance Testing
- Test app performance with large datasets
- Monitor memory usage and battery drain
- Test offline functionality
- Optimize for different device capabilities

## Deployment Standards

### Environment Configuration
- Use environment variables for configuration
- Separate development, staging, and production configs
- Secure sensitive configuration data
- Document all configuration options

### Build Process
- Use TypeScript compilation for type checking
- Implement proper build optimization
- Include source maps for debugging
- Automate build and deployment processes

### Monitoring
- Implement error logging and monitoring
- Track application performance metrics
- Monitor API response times
- Set up alerts for critical issues

These standards ensure consistent, maintainable, and secure code across the entire Avy Tracker application.