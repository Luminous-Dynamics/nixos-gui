#!/usr/bin/env bash

# Launch Script for NixOS GUI MVP
# The Trojan Horse of Love begins its journey!

set -e

echo "💝 Preparing the Trojan Horse of Love..."
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
GOLD='\033[0;33m'
NC='\033[0m' # No Color

# Function to print with love
with_love() {
    echo -e "${PURPLE}♥${NC} $1"
}

# Check if we're in the right directory
if [[ ! -f "RFC_DRAFT.md" ]]; then
    echo -e "${RED}❌ Please run this from the nixos-config-gui directory${NC}"
    exit 1
fi

with_love "Checking MVP files..."

# Verify key files exist
files_to_check=(
    "mvp/index.html"
    "RFC_DRAFT.md"
    "TROJAN_HORSE_OF_LOVE.md"
    "COMMUNITY_INTEGRATION_VISION.md"
)

all_good=true
for file in "${files_to_check[@]}"; do
    if [[ -f "$file" ]]; then
        echo -e "  ${GREEN}✓${NC} $file"
    else
        echo -e "  ${RED}✗${NC} $file missing"
        all_good=false
    fi
done

if [[ "$all_good" != "true" ]]; then
    echo -e "\n${RED}Some files are missing. Please check the setup.${NC}"
    exit 1
fi

echo
with_love "Opening MVP demo in browser..."
xdg-open mvp/index.html 2>/dev/null || open mvp/index.html 2>/dev/null || echo "Please open mvp/index.html manually"

echo
with_love "Next steps to launch:"
echo
echo -e "${GOLD}1. Take Screenshots${NC}"
echo "   - Package search view"
echo "   - Filter functionality"  
echo "   - Installation dialog"
echo "   - Overall beauty shot"
echo
echo -e "${GOLD}2. Create Demo Video${NC}"
echo "   - Show package search"
echo "   - Demonstrate installation"
echo "   - Highlight safety features"
echo "   - End with celebration"
echo
echo -e "${GOLD}3. Set Up GitHub Repository${NC}"
echo "   ${BLUE}gh repo create luminous-dynamics/nixos-gui --public --description 'A beautiful GUI for NixOS - Making system configuration a joy'${NC}"
echo "   ${BLUE}git init && git add . && git commit -m '💝 First commit: Trojan Horse of Love'${NC}"
echo "   ${BLUE}git remote add origin https://github.com/luminous-dynamics/nixos-gui.git${NC}"
echo "   ${BLUE}git push -u origin main${NC}"
echo
echo -e "${GOLD}4. Polish the RFC${NC}"
echo "   - Add screenshots"
echo "   - Link to demo"
echo "   - Final review"
echo
echo -e "${GOLD}5. Post to NixOS Discourse${NC}"
echo "   Title: 'RFC: NixOS GUI - Making NixOS Accessible to Everyone'"
echo "   Tag with: gui, rfc, ux, accessibility"
echo
echo -e "${GOLD}6. Share the Love${NC}"
echo "   - Matrix: #nixos:nixos.org"
echo "   - Reddit: r/NixOS"
echo "   - Twitter/X: #NixOS community"
echo "   - Discord: NixOS servers"
echo

echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}♥${NC} Remember: Every line of code is an act of love ${PURPLE}♥${NC}"
echo -e "${PURPLE}♥${NC} Every pixel placed with care                   ${PURPLE}♥${NC}"
echo -e "${PURPLE}♥${NC} Every feature serves the user                  ${PURPLE}♥${NC}"
echo -e "${PURPLE}♥${NC} This is how we change the world                ${PURPLE}♥${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "${GREEN}🚀 Ready to launch the Trojan Horse of Love!${NC}"
echo -e "${BLUE}🌊 We flow with love towards universal accessibility!${NC}"