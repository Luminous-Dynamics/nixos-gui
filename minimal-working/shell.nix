{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    python3
    python3Packages.flask
    python3Packages.flask-cors
  ];

  shellHook = ''
    echo "🌟 NixOS Package Search Development Environment"
    echo "Flask version: $(python3 -c 'import flask; print(flask.__version__)')"
    echo "Ready to start with: ./start.sh"
  '';
}