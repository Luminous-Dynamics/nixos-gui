# 🚀 Next Feature: Install Button

## The Feature
Add an "Install" button to each package that copies the install command to clipboard

## Why This Next?
- Immediate value for users
- Simple to implement (30 min)
- Tests our "borrow from MVP v2" approach
- No backend changes needed

## Let's Check MVP v2 First!

### 1. Check for Install UI
```bash
# What did MVP v2 do for install?
grep -r "install" mvp-v2/css/ --include="*.css"
grep -r "btn.*install" mvp-v2/ --include="*.html"
```

### 2. Borrow Their Button Style
From `mvp-v2/css/core.css`:
```css
.btn-primary {
    background: #3498db;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary:hover {
    background: #2980b9;
    transform: translateY(-1px);
}
```

### 3. Our Simple Implementation
```javascript
// Add to each package result
<button class="btn-install" onclick="copyInstallCommand('${pkg.name}')">
    📋 Copy Install Command
</button>

function copyInstallCommand(packageName) {
    const command = `nix-env -iA nixpkgs.${packageName}`;
    navigator.clipboard.writeText(command);
    
    // Show feedback (borrow MVP v2's toast style?)
    showToast('Command copied! Run in terminal: ' + command);
}
```

## Implementation Steps

1. ✅ Check MVP v2 for button styles
2. ⬜ Add button to our package results
3. ⬜ Implement copy-to-clipboard
4. ⬜ Add toast notification (if MVP v2 has one)
5. ⬜ Test with real packages

## Time Estimate
- 30 minutes to implement
- 10 minutes to borrow and adapt MVP v2 styles
- 10 minutes to test

## Success Criteria
- User can click button
- Command copies to clipboard
- User gets visual feedback
- Works on Firefox/Chrome

---

Next feature after this: Show installed status ✅/❌