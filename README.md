# NgxEventHub

⚡ A lightweight, zero-dependency Angular service for event-driven communication between components.

## 🚀 Quick Links

- **📚 [Full Documentation](./ngx-event-hub-lib/projects/ngx-event-hub/README.md)**
- **🎮 [Live Demo](./ngx-event-hub-demo)** - Interactive examples with all features
- **📦 [NPM Package](https://www.npmjs.com/package/ngx-event-hub)**

## ✨ Features

- ✅ Simple `on()` and `cast()` API
- ✅ Auto-cleanup with DestroyRef integration
- ✅ Performance optimizations (throttle, debounce, distinct)
- ✅ Scoped hubs for feature isolation
- ✅ Debug mode and inspection tools
- ✅ Zero dependencies (no RxJS required)
- ✅ Full TypeScript support

## 📦 Installation

```bash
npm install ngx-event-hub
```

## 🎯 Quick Start

```typescript
import { Component, OnInit } from '@angular/core';
import { NgxEventHubService } from 'ngx-event-hub';

@Component({
  selector: 'app-example',
  template: `<button (click)="send()">Send</button>`
})
export class ExampleComponent implements OnInit {
  constructor(private eventHub: NgxEventHubService) {}

  ngOnInit(): void {
    this.eventHub.on('myEvent', (data) => {
      console.log('Received:', data);
    });
  }

  send(): void {
    this.eventHub.cast('myEvent', 'Hello!');
  }
}
```

## 📖 Documentation

See the [full documentation](./ngx-event-hub-lib/projects/ngx-event-hub/README.md) for:
- Complete API reference
- Advanced features (throttle, debounce, scoped hubs, etc.)
- Usage examples
- Best practices

## 🎮 Demo

Run the demo app locally:

```bash
cd ngx-event-hub-demo
npm install
npm start
```

Or view the live demo at: [Demo URL]

## 📁 Project Structure

```
ngx-event-hub/
├── ngx-event-hub-lib/          # Library source
│   └── projects/
│       └── ngx-event-hub/
└── ngx-event-hub-demo/          # Demo application
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License
