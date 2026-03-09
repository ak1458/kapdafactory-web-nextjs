# KapdaFactory Testing & QA Checklist

## ✅ Automated Tests Status

### Current Test Coverage
| Test File | Tests | Status |
|-----------|-------|--------|
| `src/server/dates.test.ts` | 7 | ✅ PASS |
| `src/server/validators.test.ts` | 13 | ✅ PASS |
| **Total** | **20** | ✅ **ALL PASS** |

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run type checking
npm run typecheck

# Run linting
npm run lint
```

---

## 🔍 Manual Testing Checklist

### 1. Authentication Flow
- [ ] **Login Page**
  - [ ] Access `/login` - should show login form
  - [ ] Try invalid credentials - should show error
  - [ ] Login with `admin@admin.com` / `admin123` - should redirect to dashboard
  - [ ] Check "Remember me" functionality (if available)
  - [ ] Test "Forgot Password" link navigation

- [ ] **Protected Routes**
  - [ ] Access `/dashboard` without login - should redirect to `/login`
  - [ ] Access `/orders` without login - should redirect to `/login`
  - [ ] Access `/collections` without login - should redirect to `/login`
  - [ ] After login, access `/login` - should redirect to `/dashboard`

- [ ] **Logout**
  - [ ] Click logout - should clear token and redirect to login
  - [ ] Try accessing protected route after logout - should require login

### 2. Dashboard
- [ ] **Stats Cards**
  - [ ] Total Orders count displays correctly
  - [ ] Pending Orders count displays correctly
  - [ ] Ready Orders count displays correctly
  - [ ] Today's Deliveries count displays correctly

- [ ] **Recent Orders**
  - [ ] Last 5 orders display correctly
  - [ ] Clicking order navigates to detail page
  - [ ] Status badges show correct colors

- [ ] **Quick Actions**
  - [ ] "Create Order" button works
  - [ ] "View Orders" button works
  - [ ] "Daily Collections" button works

### 3. Order Management
- [ ] **Create Order**
  - [ ] Navigate to `/orders/create`
  - [ ] Token/Bill number field accepts input
  - [ ] Customer name field works
  - [ ] Phone number field works
  - [ ] Entry date defaults to today
  - [ ] Delivery date picker works
  - [ ] Amount field accepts numbers only
  - [ ] Remarks field works
  - [ ] Image upload (max 8 images)
  - [ ] Image preview shows before submit
  - [ ] Image removal works
  - [ ] Submit creates order successfully
  - [ ] Success toast appears
  - [ ] Form resets after successful creation

- [ ] **Order List**
  - [ ] All orders display correctly
  - [ ] Search functionality works
  - [ ] Filter by status works (Pending, Ready, Delivered, All)
  - [ ] Sort by date/token works
  - [ ] Pagination (if applicable)
  - [ ] Clicking order card navigates to detail
  - [ ] Bottom navigation works properly

- [ ] **Order Detail**
  - [ ] Order info displays correctly
  - [ ] Status badge shows correct color
  - [ ] Customer details visible
  - [ ] Payment summary correct
  - [ ] Image gallery displays
  - [ ] Image click to enlarge (if available)
  - [ ] Add payment functionality
  - [ ] Status change (Pending → Ready → Delivered)
  - [ ] Edit order button works
  - [ ] Delete order works (with confirmation)

- [ ] **Edit Order**
  - [ ] Pre-populates existing data
  - [ ] Can modify all fields
  - [ ] Can add/remove images
  - [ ] Save changes works
  - [ ] Cancel returns to detail page

### 4. Daily Collections
- [ ] **Date Range Filter**
  - [ ] Default shows today's collections
  - [ ] Date "From" picker works
  - [ ] Date "To" picker works
  - [ ] Filter applies correctly

- [ ] **Summary Cards**
  - [ ] Total Collected amount correct
  - [ ] Orders Delivered count correct
  - [ ] Cash amount correct
  - [ ] Online/UPI amount correct

- [ ] **Collections List**
  - [ ] Groups by date correctly
  - [ ] Expand/collapse works
  - [ ] Shows order details when expanded
  - [ ] Shows customer name and amount

- [ ] **Export**
  - [ ] Export button opens modal
  - [ ] Date range selection works
  - [ ] Export to CSV downloads file
  - [ ] CSV contains correct data

### 5. Export Functionality
- [ ] **Orders Export**
  - [ ] Export modal opens
  - [ ] Can select date range (Today, Week, Month, Custom)
  - [ ] Can select fields to include
  - [ ] CSV downloads successfully
  - [ ] CSV data is accurate

- [ ] **Collections Export**
  - [ ] Export collections works
  - [ ] CSV format is correct

### 6. Image Handling
- [ ] **Upload**
  - [ ] Can select multiple images
  - [ ] Max 8 images enforced
  - [ ] Large images compressed
  - [ ] Progress indicator (if available)
  - [ ] Error for invalid file types

- [ ] **Display**
  - [ ] Images load correctly
  - [ ] Thumbnails display
  - [ ] Full-size view works
  - [ ] No broken image links

### 7. Responsive Design
- [ ] **Mobile (320px - 480px)**
  - [ ] Layout adapts correctly
  - [ ] Bottom navigation visible
  - [ ] Forms are usable
  - [ ] Text is readable
  - [ ] Images scale properly

- [ ] **Tablet (481px - 768px)**
  - [ ] Layout adapts correctly
  - [ ] Navigation works

- [ ] **Desktop (769px+)**
  - [ ] Layout looks good
  - [ ] No horizontal scroll

### 8. Edge Cases
- [ ] **Empty States**
  - [ ] No orders message displays
  - [ ] No collections message displays
  - [ ] Empty search results handled

- [ ] **Error Handling**
  - [ ] 404 page works
  - [ ] Network error messages
  - [ ] Form validation errors
  - [ ] Server error handling

- [ ] **Large Data**
  - [ ] Many orders load without crash
  - [ ] Pagination works for large datasets
  - [ ] Search performance acceptable

---

## 📱 Mobile Responsiveness Check

### Devices to Test
1. **iPhone SE** (375x667)
2. **iPhone 12/13/14** (390x844)
3. **Samsung Galaxy S20** (360x800)
4. **iPad** (768x1024)
5. **Desktop** (1920x1080)

### Browser DevTools Testing
```bash
# Open Chrome DevTools → Toggle Device Toolbar
# Test these viewports:
- 375x667 (iPhone SE)
- 390x844 (iPhone 14)
- 768x1024 (iPad)
- 1440x900 (Laptop)
```

---

## ⚡ Performance Optimization

### Current Build Analysis
```bash
# Analyze bundle size
npm run build
```

### Performance Checklist
- [ ] Lighthouse score > 90
- [ ] First Contentful Paint < 1.8s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3.8s
- [ ] Cumulative Layout Shift < 0.1

### Optimization Opportunities
1. **Images**
   - [ ] Use WebP format where possible
   - [ ] Implement lazy loading
   - [ ] Optimize image sizes

2. **Code Splitting**
   - [ ] Check for large bundles
   - [ ] Lazy load heavy components

3. **Caching**
   - [ ] API responses cached appropriately
   - [ ] Static assets have long cache headers

4. **Font Loading**
   - [ ] Use `font-display: swap`
   - [ ] Preload critical fonts

---

## 🔒 Security Checklist

- [ ] HTTPS enforced
- [ ] Auth token stored securely (httpOnly cookie)
- [ ] CSRF protection on mutations
- [ ] XSS prevention (input sanitization)
- [ ] Rate limiting on API routes
- [ ] Environment variables not exposed client-side

---

## 🚀 Pre-Deployment Checklist

Before deploying to production:

- [ ] All automated tests pass
- [ ] Manual testing completed
- [ ] Mobile responsive verified
- [ ] Performance budget met
- [ ] Environment variables set in Vercel
- [ ] Build succeeds without errors
- [ ] No console errors in production build

---

## 🐛 Known Issues Log

| Issue | Status | Priority | Notes |
|-------|--------|----------|-------|
| None currently | - | - | - |

---

## 📝 Testing Notes

**Test Date:** ___________
**Tester:** ___________
**Environment:** ___________
**Browser:** ___________

### Issues Found
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 
