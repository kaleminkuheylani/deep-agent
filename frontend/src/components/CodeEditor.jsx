import { useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";

const DEFAULT_CODE = `import torch
import torch.nn as nn
import torch.optim as optim

class SimpleNet(nn.Module):
    def __init__(self):
        super(SimpleNet, self).__init__()
        self.fc1 = nn.Linear(784, 256)
        self.fc2 = nn.Linear(256, 128)
        self.fc3 = nn.Linear(128, 10)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.2)

    def forward(self, x):
        x = x.view(-1, 784)
        x = self.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.relu(self.fc2(x))
        x = self.fc3(x)
        return x

# Model ve optimizer
model = SimpleNet()
optimizer = optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()

# Eğitim döngüsü
for epoch in range(10):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0
    
    # Training loop (DataLoader gerekli)
    # for batch_idx, (data, target) in enumerate(train_loader):
    #     optimizer.zero_grad()
    #     output = model(data)
    #     loss = criterion(output, target)
    #     loss.backward()
    #     optimizer.step()
    
    print(f"Epoch {epoch+1} tamamlandı")
`;

export default function CodeEditor({ code, onCodeChange, lintResults }) {
  const editorRef = useRef(null);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.defineTheme("deepagent", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "569CD6" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "type", foreground: "4EC9B0" },
      ],
      colors: {
        "editor.background": "#0C0C0E",
        "editor.foreground": "#D4D4D4",
        "editor.lineHighlightBackground": "#18181B",
        "editor.selectionBackground": "#264F78",
        "editorLineNumber.foreground": "#3F3F46",
        "editorLineNumber.activeForeground": "#A1A1AA",
        "editor.inactiveSelectionBackground": "#1A1A2E",
        "editorIndentGuide.background": "#27272A",
        "editorCursor.foreground": "#0055FF",
      },
    });
    monaco.editor.setTheme("deepagent");
  }, []);

  const handleChange = useCallback((value) => {
    onCodeChange(value || "");
  }, [onCodeChange]);

  return (
    <div data-testid="code-editor-area" className="flex-1 w-full relative">
      <Editor
        height="100%"
        defaultLanguage="python"
        value={code || DEFAULT_CODE}
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 20,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          smoothScrolling: true,
          padding: { top: 12, bottom: 12 },
          bracketPairColorization: { enabled: true },
          wordWrap: "on",
        }}
      />
    </div>
  );
}

export { DEFAULT_CODE };
