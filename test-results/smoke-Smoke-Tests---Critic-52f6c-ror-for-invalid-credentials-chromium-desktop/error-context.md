# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "Welcome Back" [level=1] [ref=e6]
      - paragraph [ref=e7]: Sign in to manage your orders
    - generic [ref=e8]:
      - generic [ref=e9]: Invalid email or password
      - generic [ref=e10]:
        - generic [ref=e11]: Email Address
        - textbox "admin@admin.com" [ref=e12]: wrong@example.com
      - generic [ref=e13]:
        - generic [ref=e14]: Password
        - textbox "••••••••" [ref=e15]: wrongpassword
      - button "Sign In" [ref=e16]
      - link "Forgot your password?" [ref=e18] [cursor=pointer]:
        - /url: /forgot-password
```