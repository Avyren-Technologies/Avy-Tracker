# Database CA Certificate Configuration

## Overview
The database configuration now supports loading the CA certificate from either an environment variable or a file, with the environment variable taking precedence.

## Environment Variable Setup

### Option 1: Environment Variable (Recommended for Production)
Set the `DATABASE_CA_CERT` environment variable with the CA certificate content:

```bash
# In your .env file or environment
DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/OvD8VqUMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMTkwOTEyMjE1MjAyWhcNMjkwOTEwMjE1MjAyWjBF
...
-----END CERTIFICATE-----"
```

### Option 2: File-based (Fallback)
If the environment variable is not set, the system will look for `ca.pem` in the `backend/src/config/` directory.

## Configuration Priority

1. **First Priority**: `DATABASE_CA_CERT` environment variable
2. **Fallback**: `backend/src/config/ca.pem` file

## Benefits

### Environment Variable Approach
- ✅ **Secure**: Certificate is not stored in the codebase
- ✅ **Deployment-friendly**: Easy to configure in different environments
- ✅ **CI/CD Compatible**: Can be set in deployment pipelines
- ✅ **Container-friendly**: Works well with Docker and Kubernetes

### File-based Fallback
- ✅ **Backward Compatible**: Existing setups continue to work
- ✅ **Development-friendly**: Easy to use during development
- ✅ **Local Testing**: Convenient for local development

## Usage Examples

### Development
```bash
# Option 1: Use environment variable
export DATABASE_CA_CERT="$(cat path/to/your/ca.pem)"

# Option 2: Place ca.pem file in backend/src/config/ca.pem
# No additional setup needed
```

### Production Deployment
```bash
# Set in your deployment environment
DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----
[Your CA Certificate Content Here]
-----END CERTIFICATE-----"
```

### Docker
```dockerfile
# In your Dockerfile or docker-compose.yml
ENV DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----
[Your CA Certificate Content Here]
-----END CERTIFICATE-----"
```

### Kubernetes
```yaml
# In your Kubernetes deployment
apiVersion: v1
kind: Secret
metadata:
  name: database-ca-cert
type: Opaque
stringData:
  ca-cert: |
    -----BEGIN CERTIFICATE-----
    [Your CA Certificate Content Here]
    -----END CERTIFICATE-----
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: DATABASE_CA_CERT
          valueFrom:
            secretKeyRef:
              name: database-ca-cert
              key: ca-cert
```

## Error Handling

The system will log which method is being used:
- `"Using CA certificate from environment variable"` - When using env var
- `"Using CA certificate from file: [path]"` - When using file
- `"CA certificate file not found at: [path]"` - When file is missing
- `"Please set DATABASE_CA_CERT environment variable or ensure ca.pem file exists"` - Warning message

## Migration Guide

### From File-based to Environment Variable

1. **Extract your current CA certificate**:
   ```bash
   cat backend/src/config/ca.pem
   ```

2. **Set the environment variable**:
   ```bash
   export DATABASE_CA_CERT="$(cat backend/src/config/ca.pem)"
   ```

3. **Test the configuration**:
   ```bash
   # Restart your application and check logs
   # You should see: "Using CA certificate from environment variable"
   ```

4. **Optional**: Remove the ca.pem file from the codebase for security:
   ```bash
   rm backend/src/config/ca.pem
   # Add ca.pem to .gitignore to prevent accidental commits
   ```

## Security Best Practices

1. **Never commit CA certificates to version control**
2. **Use environment variables in production**
3. **Rotate certificates regularly**
4. **Use secrets management systems in production** (AWS Secrets Manager, Azure Key Vault, etc.)
5. **Add ca.pem to .gitignore** if using file-based approach

## Troubleshooting

### Common Issues

1. **"CA certificate not found in environment variable or file"**
   - Ensure `DATABASE_CA_CERT` is set correctly
   - Check that ca.pem exists in the correct location
   - Verify the certificate format (should include BEGIN/END lines)

2. **SSL connection errors**
   - Verify the CA certificate is correct for your database
   - Check that the certificate hasn't expired
   - Ensure the certificate chain is complete

3. **Environment variable not being read**
   - Check that dotenv is loading your .env file
   - Verify the environment variable name is exactly `DATABASE_CA_CERT`
   - Ensure there are no extra spaces or quotes in the variable value
