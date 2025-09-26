# Complete Azure CI/CD Setup Guide for AvyTracker Backend

## Prerequisites
- Azure subscription with appropriate permissions
- GitHub repository with your code
- Docker Hub account
- All required secrets and environment variables ready

## Step 1: Azure Resource Setup (GUI-based)

### 1.1 Create Azure Container Registry (ACR)
1. **Navigate to Azure Portal** (portal.azure.com)
2. **Click "Create a resource"**
3. **Search for "Container Registry"**
4. **Click "Create"**
5. **Fill in the details:**
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Create new or use existing (e.g., `avy-tracker-rg`)
   - **Registry Name**: `avyTrackerRegistry` (must be globally unique)
   - **Location**: Choose closest to your users
   - **SKU**: Basic (for cost optimization) or Standard
   - **Admin User**: Enable (for Docker Hub integration)
6. **Click "Review + Create"** then **"Create"**

### 1.2 Create Azure App Service
1. **In Azure Portal, click "Create a resource"**
2. **Search for "Web App"**
3. **Click "Create"**
4. **Fill in the details:**
   - **Subscription**: Your Azure subscription
   - **Resource Group**: Same as ACR (`avy-tracker-rg`)
   - **Name**: `AvyTrackerServer` (must be globally unique)
   - **Publish**: Docker Container
   - **Operating System**: Linux
   - **Region**: Same as ACR
   - **Pricing Plan**: 
     - **S1** (1 vCPU, 1.75 GB RAM) for production
     - **B1** (1 vCPU, 1 GB RAM) for testing
5. **Click "Next: Docker"**
6. **Docker Configuration:**
   - **Options**: Single Container
   - **Image Source**: Docker Hub
   - **Access Type**: Public
   - **Image and Tag**: `chiranjeevichetan/avy-trackerapp:latest`
7. **Click "Review + Create"** then **"Create"**

### 1.3 Configure App Service Settings
1. **Navigate to your App Service** (`AvyTrackerServer`)
2. **Go to "Configuration" in the left menu**
3. **Add these Application Settings:**
   ```
   WEBSITES_ENABLE_APP_SERVICE_STORAGE = false
   WEBSITES_PORT = 8080
   DOCKER_ENABLE_CI = true
   ```

## Step 2: GitHub Secrets Configuration

### 2.1 Navigate to GitHub Secrets
1. **Go to your GitHub repository**
2. **Click "Settings" tab**
3. **Click "Secrets and variables" → "Actions"**
4. **Click "New repository secret"**

### 2.2 Add Required Secrets
Add each of these secrets one by one:

#### Database & Core Secrets:
```
DATABASE_URL = postgresql://username:password@host:port/database?sslmode=require
JWT_SECRET = your-jwt-secret-key
JWT_REFRESH_SECRET = your-refresh-secret-key
SESSION_SECRET = your-session-secret
BIOMETRIC_ENCRYPTION_KEY = your-biometric-encryption-key
```

#### Email Configuration:
```
EMAIL_USER = your-email@domain.com
EMAIL_PASS = your-email-password
```

#### API Keys:
```
GOOGLE_GEMINI_API_KEY = your-gemini-api-key
GOOGLE_MAPS_API_KEY = your-google-maps-api-key
```

#### Redis & External Services:
```
REDIS_URL = redis://username:password@host:port
SPARROW_ENDPOINT = your-sparrow-endpoint
```

#### Twilio Configuration:
```
TWILIO_ACCOUNT_SID = your-twilio-account-sid
TWILIO_AUTH_TOKEN = your-twilio-auth-token
TWILIO_PHONE_NUMBER = your-twilio-phone-number
```

#### URLs:
```
FRONTEND_URL = https://your-frontend-domain.com
API_BASE_URL = https://your-api-domain.com
```

#### Docker Hub:
```
DOCKER_USERNAME = your-docker-hub-username
DOCKER_PASSWORD = your-docker-hub-password
```

#### Azure Deployment:
```
AZURE_WEBAPP_PUBLISH_PROFILE = (will be generated in next step)
```

#### Firebase & SSL:
```
FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 = (base64 encoded Firebase service account JSON)
CA_PEM = (your SSL certificate content)
```

## Step 3: Generate Azure Publish Profile

### 3.1 Download Publish Profile
1. **Go to your App Service** (`AvyTrackerServer`)
2. **Click "Get publish profile"** (download button)
3. **Open the downloaded file** (`.PublishSettings`)
4. **Copy the entire content**
5. **Add it as GitHub secret** `AZURE_WEBAPP_PUBLISH_PROFILE`

## Step 4: Optimize GitHub Workflow

## Step 5: Testing and Verification

### 5.1 Test the Pipeline
1. **Make a small change** to any file in the `backend/` directory
2. **Commit and push** to the `main` branch
3. **Go to GitHub Actions** tab in your repository
4. **Monitor the workflow execution**

### 5.2 Verify Deployment
1. **Check Azure App Service logs:**
   - Go to your App Service in Azure Portal
   - Click "Log stream" to see real-time logs
   - Click "Logs" to see historical logs

2. **Test the API endpoints:**
   ```bash
   # Test health endpoint
   curl https://AvyTrackerServer.azurewebsites.net/api/test
   
   # Test if the app is running
   curl https://AvyTrackerServer.azurewebsites.net
   ```

## Step 6: Post-Deployment Configuration

### 6.1 Configure Custom Domain (Optional)
1. **In Azure App Service, go to "Custom domains"**
2. **Add your domain**
3. **Configure SSL certificate**

### 6.2 Set up Monitoring
1. **Enable Application Insights:**
   - Go to "Application Insights" in your App Service
   - Click "Turn on Application Insights"
   - Create new or use existing Application Insights resource

2. **Configure Alerts:**
   - Go to "Alerts" in your App Service
   - Set up alerts for high CPU, memory usage, and errors

## Step 7: Troubleshooting Common Issues


[1 tool called]

### Common Issues and Solutions:

#### 1. **Docker Build Failures**
- **Issue**: Build fails due to missing dependencies
- **Solution**: Check Dockerfile and ensure all required files are copied

#### 2. **Environment Variables Not Loading**
- **Issue**: App starts but can't connect to database
- **Solution**: Verify all secrets are correctly set in GitHub and Azure App Service

#### 3. **Port Configuration Issues**
- **Issue**: App doesn't start or shows 502 errors
- **Solution**: Ensure `WEBSITES_PORT=8080` is set in Azure App Service configuration

#### 4. **SSL Certificate Issues**
- **Issue**: Database connection fails due to SSL
- **Solution**: Verify `CA_PEM` secret contains the correct certificate

#### 5. **Memory/CPU Issues**
- **Issue**: App crashes or becomes unresponsive
- **Solution**: Upgrade to a higher App Service plan (S2, P1, etc.)

## Step 8: Monitoring and Maintenance

### 8.1 Set up Health Checks
Your Dockerfile already includes a health check. Monitor it in Azure:
1. **Go to "Health check" in your App Service**
2. **Enable health check**
3. **Set path**: `/api/test`

### 8.2 Log Management
1. **Enable Application Insights** for detailed logging
2. **Set up log retention policies**
3. **Configure log alerts** for critical errors

### 8.3 Backup Strategy
1. **Enable automatic backups** in Azure App Service
2. **Set up database backups** (if using Azure Database)
3. **Test restore procedures** regularly

## Step 9: Security Best Practices

### 9.1 Network Security
1. **Enable HTTPS only** in App Service configuration
2. **Configure IP restrictions** if needed
3. **Use Azure Key Vault** for sensitive secrets (advanced)

### 9.2 Container Security
1. **Regularly update base images**
2. **Scan images for vulnerabilities**
3. **Use non-root user** (already implemented in your Dockerfile)

## Step 10: Cost Optimization

### 10.1 App Service Plans
- **Development**: B1 (Basic)
- **Production**: S1 (Standard) or higher
- **High Traffic**: P1 (Premium) or higher

### 10.2 Monitoring Costs
1. **Set up cost alerts** in Azure
2. **Review usage regularly**
3. **Optimize resource allocation**

## Quick Start Checklist

- [ ] Create Azure Container Registry
- [ ] Create Azure App Service
- [ ] Configure GitHub Secrets
- [ ] Download and add Azure Publish Profile
- [ ] Test the pipeline with a small change
- [ ] Verify deployment works
- [ ] Set up monitoring and alerts
- [ ] Configure custom domain (optional)
- [ ] Test all API endpoints
- [ ] Set up backup strategy


[1 tool called]

## Next Steps

1. **Start with Step 1** - Create the Azure resources using the GUI
2. **Follow Step 2** - Configure all GitHub secrets
3. **Complete Step 3** - Generate and add the Azure publish profile
4. **Test the pipeline** by making a small change to trigger the workflow

## Support and Troubleshooting

If you encounter any issues during setup:

1. **Check Azure App Service logs** for deployment errors
2. **Review GitHub Actions logs** for build/deployment failures
3. **Verify all secrets** are correctly configured
4. **Test database connectivity** from Azure App Service
5. **Check firewall rules** if using external databases

Your workflow is now optimized and ready for deployment. The pipeline will automatically build, push to Docker Hub, and deploy to Azure whenever you push changes to the `main` branch in the `backend/` directory.

Would you like me to help you with any specific step or do you have questions about any part of this setup process?