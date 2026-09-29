import Link from "next/link"
import {
  BarChart3,
  CheckCircle2,
  Package,
  Shield,
  ShoppingCart,
  Truck,
  ArrowRight,
  Star,
  TrendingUp,
  Zap,
  Award,
  Clock,
  DollarSign,
  Smartphone,
  Database,
  Bell,
  Settings,
  Activity,
  GitBranch,
  BarChart,
  Search,
  Upload,
  RefreshCw,
  Eye,
  Wifi,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export default async function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Inventioo
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="#integrations"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Integrations
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                Start Free Trial
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-20 md:py-32">
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
          <div className="container relative mx-auto px-4">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
              <div className="space-y-8">
                <Badge variant="secondary" className="mb-4 px-4 py-2">
                  <Zap className="mr-2 h-4 w-4" />
                  Trusted by 10,000+ businesses worldwide
                </Badge>
                <h1 className="text-4xl font-bold tracking-tight sm:text-6xl md:text-7xl">
                  Transform Your{" "}
                  <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Inventory Operations
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl">
                  Enterprise-grade inventory management platform that reduces costs by 30%, eliminates stockouts, and
                  scales with your business growth.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Link href="/register">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-4 text-lg"
                    >
                      Start Free 14-Day Trial
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="#demo">
                    <Button size="lg" variant="outline" className="px-8 py-4 text-lg bg-transparent">
                      Watch Demo
                    </Button>
                  </Link>
                </div>
                <div className="flex items-center gap-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Setup in under 5 minutes</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="relative rounded-2xl bg-white p-6 shadow-2xl border">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="ml-4 text-sm text-muted-foreground">Inventioo Dashboard</div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Products</p>
                            <p className="text-2xl font-bold text-blue-600">12,847</p>
                          </div>
                          <Package className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Orders Today</p>
                            <p className="text-2xl font-bold text-green-600">1,247</p>
                          </div>
                          <ShoppingCart className="h-8 w-8 text-green-600" />
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Revenue</p>
                            <p className="text-2xl font-bold text-purple-600">$89.2K</p>
                          </div>
                          <TrendingUp className="h-8 w-8 text-purple-600" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Inventory Levels</h3>
                        <Badge variant="secondary">Live</Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Electronics</span>
                          <span>85%</span>
                        </div>
                        <Progress value={85} className="h-2" />
                        <div className="flex items-center justify-between text-sm">
                          <span>Clothing</span>
                          <span>92%</span>
                        </div>
                        <Progress value={92} className="h-2" />
                        <div className="flex items-center justify-between text-sm">
                          <span>Home & Garden</span>
                          <span>67%</span>
                        </div>
                        <Progress value={67} className="h-2" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute -top-4 -right-4 bg-white rounded-lg shadow-lg p-3 border">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-orange-500" />
                    <span className="text-sm">Low stock alert</span>
                  </div>
                </div>

                <div className="absolute -bottom-4 -left-4 bg-white rounded-lg shadow-lg p-3 border">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Order completed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b bg-white py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">10,000+</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">$2.5B+</div>
                <div className="text-sm text-muted-foreground">Inventory Managed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime SLA</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600">30%</div>
                <div className="text-sm text-muted-foreground">Cost Reduction</div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4">
                How It Works
              </Badge>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Get started in minutes, not months</h2>
              <p className="text-xl text-muted-foreground">
                Our intuitive setup process gets you up and running quickly with minimal IT involvement.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 text-white mb-6">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">1. Import Your Data</h3>
                  <p className="text-muted-foreground mb-6">
                    Seamlessly import your existing product catalog, inventory levels, and supplier information with our
                    automated tools.
                  </p>

                  <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Database className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium">Data Import</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span>Products.csv</span>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Inventory.xlsx</span>
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span>Suppliers.csv</span>
                        <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 transform translate-x-4"></div>
              </div>

              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-purple-700 text-white mb-6">
                    <Settings className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">2. Configure Settings</h3>
                  <p className="text-muted-foreground mb-6">
                    Set up your business rules, reorder points, user permissions, and integrations with our guided setup
                    wizard.
                  </p>

                  <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Settings className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium">Configuration</span>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Reorder Points</span>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs">User Permissions</span>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs">Integrations</span>
                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-purple-600 to-green-600 transform translate-x-4"></div>
              </div>

              <div className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-600 to-green-700 text-white mb-6">
                    <Activity className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">3. Start Managing</h3>
                  <p className="text-muted-foreground mb-6">
                    Begin tracking inventory, processing orders, and gaining insights with real-time dashboards and
                    automated workflows.
                  </p>

                  <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Live Dashboard</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 p-2 rounded text-center">
                        <div className="text-lg font-bold text-green-600">847</div>
                        <div className="text-xs text-muted-foreground">Orders</div>
                      </div>
                      <div className="bg-blue-50 p-2 rounded text-center">
                        <div className="text-lg font-bold text-blue-600">12K</div>
                        <div className="text-xs text-muted-foreground">Products</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4">
                Features
              </Badge>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Powerful features for modern businesses
              </h2>
              <p className="text-xl text-muted-foreground">
                Everything you need to manage inventory, orders, and suppliers in one integrated platform.
              </p>
            </div>

            <div className="grid gap-12 lg:grid-cols-2 items-center mb-20">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                    <Package className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold">Smart Inventory Tracking</h3>
                </div>
                <p className="text-lg text-muted-foreground">
                  AI-powered demand forecasting and automated reorder points prevent stockouts while optimizing carrying
                  costs. Get real-time visibility across all locations.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Real-time stock level monitoring</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Predictive analytics and demand forecasting</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Multi-location inventory management</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Automated low stock alerts</span>
                  </li>
                </ul>
              </div>

              <div className="relative">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8">
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold">Inventory Overview</h4>
                      <Badge variant="secondary">Live</Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <Package className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium">Wireless Headphones</div>
                            <div className="text-sm text-muted-foreground">SKU: WH-001</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">847</div>
                          <div className="text-sm text-muted-foreground">In Stock</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                            <Package className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium">Gaming Mouse</div>
                            <div className="text-sm text-muted-foreground">SKU: GM-002</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-orange-600">23</div>
                          <div className="text-sm text-orange-600">Low Stock</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                            <Package className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium">Coffee Beans</div>
                            <div className="text-sm text-muted-foreground">SKU: CB-003</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">1,247</div>
                          <div className="text-sm text-muted-foreground">In Stock</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-12 lg:grid-cols-2 items-center mb-20">
              <div className="order-2 lg:order-1 relative">
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8">
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold">Sales Analytics</h4>
                      <div className="flex gap-2">
                        <Badge variant="outline">This Month</Badge>
                        <BarChart className="h-4 w-4 text-purple-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">$89.2K</div>
                        <div className="text-sm text-muted-foreground">Revenue</div>
                        <div className="text-xs text-green-600">↑ 12.5%</div>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">1,247</div>
                        <div className="text-sm text-muted-foreground">Orders</div>
                        <div className="text-xs text-blue-600">↑ 8.3%</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Week 1</span>
                        <span>$18.2K</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                          style={{ width: "60%" }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span>Week 2</span>
                        <span>$22.8K</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                          style={{ width: "75%" }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span>Week 3</span>
                        <span>$26.1K</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                          style={{ width: "85%" }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span>Week 4</span>
                        <span>$22.1K</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                          style={{ width: "72%" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="order-1 lg:order-2 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-white">
                    <BarChart3 className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold">Advanced Analytics</h3>
                </div>
                <p className="text-lg text-muted-foreground">
                  Comprehensive reporting and business intelligence help you make data-driven decisions. Track
                  performance, identify trends, and optimize operations.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Real-time performance dashboards</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Custom report builder with 50+ templates</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Automated insights and recommendations</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Export to Excel, PDF, and API access</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="grid gap-12 lg:grid-cols-2 items-center">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600 text-white">
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold">Mobile-First Design</h3>
                </div>
                <p className="text-lg text-muted-foreground">
                  Manage your inventory on the go with our native mobile apps. Scan barcodes, update stock levels, and
                  process orders from anywhere.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Native iOS and Android apps</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Barcode scanning and QR code support</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Offline mode with sync capabilities</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Push notifications for critical alerts</span>
                  </li>
                </ul>

                <div className="flex gap-4">
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <Smartphone className="h-4 w-4" />
                    Download iOS App
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent">
                    <Smartphone className="h-4 w-4" />
                    Download Android App
                  </Button>
                </div>
              </div>

              <div className="relative flex justify-center">
                <div className="relative">
                  <div className="w-64 h-[500px] bg-slate-900 rounded-[3rem] p-2">
                    <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden">
                      <div className="bg-slate-900 h-8 flex items-center justify-between px-6 text-white text-xs">
                        <span>9:41</span>
                        <div className="flex gap-1">
                          <Wifi className="h-3 w-3" />
                          <div className="w-4 h-2 border border-white rounded-sm">
                            <div className="w-3 h-1 bg-white rounded-sm m-0.5"></div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold">Inventory</h4>
                          <Search className="h-5 w-5 text-muted-foreground" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-blue-50 p-3 rounded-lg text-center">
                            <Package className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                            <div className="text-lg font-bold text-blue-600">12.8K</div>
                            <div className="text-xs text-muted-foreground">Products</div>
                          </div>
                          <div className="bg-green-50 p-3 rounded-lg text-center">
                            <ShoppingCart className="h-6 w-6 text-green-600 mx-auto mb-1" />
                            <div className="text-lg font-bold text-green-600">847</div>
                            <div className="text-xs text-muted-foreground">Orders</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-600 rounded"></div>
                              <div>
                                <div className="text-sm font-medium">Headphones</div>
                                <div className="text-xs text-muted-foreground">847 units</div>
                              </div>
                            </div>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div className="flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-orange-600 rounded"></div>
                              <div>
                                <div className="text-sm font-medium">Mouse</div>
                                <div className="text-xs text-orange-600">23 units - Low</div>
                              </div>
                            </div>
                            <Bell className="h-4 w-4 text-orange-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="absolute -right-8 top-20 bg-white rounded-lg shadow-lg p-3 border max-w-32">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-orange-500" />
                      <span className="text-xs">Stock Alert</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="integrations" className="py-20 bg-slate-50">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4">
                Integrations
              </Badge>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Connects with your existing tools</h2>
              <p className="text-xl text-muted-foreground">
                Seamlessly integrate with popular e-commerce platforms, accounting software, and shipping providers.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 mb-12">
              <Card className="text-center p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-blue-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2">E-commerce</h3>
                <p className="text-sm text-muted-foreground">Shopify, WooCommerce, Magento, BigCommerce</p>
              </Card>

              <Card className="text-center p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-green-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2">Accounting</h3>
                <p className="text-sm text-muted-foreground">QuickBooks, Xero, Sage, NetSuite</p>
              </Card>

              <Card className="text-center p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-purple-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2">Shipping</h3>
                <p className="text-sm text-muted-foreground">FedEx, UPS, DHL, USPS</p>
              </Card>

              <Card className="text-center p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-orange-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-2">ERP Systems</h3>
                <p className="text-sm text-muted-foreground">SAP, Oracle, Microsoft Dynamics</p>
              </Card>
            </div>

            <div className="text-center">
              <p className="text-muted-foreground mb-4">Need a custom integration?</p>
              <Button variant="outline">
                <GitBranch className="mr-2 h-4 w-4" />
                View All Integrations
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20 text-white">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Proven ROI for Enterprise Customers
              </h2>
              <p className="mb-16 text-xl text-slate-300">
                Our customers see measurable results within the first 90 days
              </p>
              <div className="grid gap-8 md:grid-cols-3">
                <div className="rounded-lg bg-white/10 p-8 backdrop-blur">
                  <DollarSign className="mx-auto mb-4 h-12 w-12 text-green-400" />
                  <div className="text-3xl font-bold text-green-400">30%</div>
                  <div className="text-slate-300">Cost Reduction</div>
                  <div className="mt-2 text-sm text-slate-400">Average savings on inventory carrying costs</div>
                </div>
                <div className="rounded-lg bg-white/10 p-8 backdrop-blur">
                  <Clock className="mx-auto mb-4 h-12 w-12 text-blue-400" />
                  <div className="text-3xl font-bold text-blue-400">75%</div>
                  <div className="text-slate-300">Time Savings</div>
                  <div className="mt-2 text-sm text-slate-400">Reduction in manual inventory tasks</div>
                </div>
                <div className="rounded-lg bg-white/10 p-8 backdrop-blur">
                  <TrendingUp className="mx-auto mb-4 h-12 w-12 text-purple-400" />
                  <div className="text-3xl font-bold text-purple-400">95%</div>
                  <div className="text-slate-300">Accuracy Rate</div>
                  <div className="mt-2 text-sm text-slate-400">Inventory accuracy improvement</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="customers" className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4">
                Customer Success
              </Badge>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">Trusted by industry leaders</h2>
              <p className="text-xl text-muted-foreground">
                See how companies like yours are transforming their operations
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              <Card className="border-0 bg-gradient-to-br from-blue-50 to-blue-100">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
                      <span className="text-lg font-bold">SM</span>
                    </div>
                    <div>
                      <CardTitle>Sarah Mitchell</CardTitle>
                      <CardDescription>VP Operations, TechCorp Industries</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    &quot;Inventioo transformed our inventory management. We reduced carrying costs by 35% and eliminated
                    stockouts completely. The ROI was evident within 60 days.&quot;
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 bg-gradient-to-br from-purple-50 to-purple-100">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white">
                      <span className="text-lg font-bold">MJ</span>
                    </div>
                    <div>
                      <CardTitle>Michael Johnson</CardTitle>
                      <CardDescription>Supply Chain Director, GlobalLogistics</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    &quot;The analytics capabilities are game-changing. We now have complete visibility across our entire
                    supply chain and can make data-driven decisions instantly.&quot;
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 bg-gradient-to-br from-green-50 to-green-100">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white">
                      <span className="text-lg font-bold">LC</span>
                    </div>
                    <div>
                      <CardTitle>Lisa Chen</CardTitle>
                      <CardDescription>CEO, FastTrack Distribution</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    &quot;Implementation was seamless and the support team is exceptional. We&apos;re processing 3x more orders
                    with the same team size.&quot;
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-slate-50 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center mb-16">
              <Badge variant="outline" className="mb-4">
                Pricing
              </Badge>
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Enterprise pricing that scales with you
              </h2>
              <p className="text-xl text-muted-foreground">
                Transparent pricing with no hidden fees. All plans include 24/7 support.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Professional</CardTitle>
                  <div className="text-3xl font-bold">$199</div>
                  <CardDescription>per month, billed annually</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Up to 10,000 SKUs</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>10 user accounts</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Advanced analytics</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>API access</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Email & chat support</span>
                    </li>
                  </ul>
                  <Button className="mt-6 w-full bg-transparent" variant="outline">
                    Start Free Trial
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 border-blue-600 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-blue-600">Most Popular</Badge>
                </div>
                <CardHeader>
                  <CardTitle>Enterprise</CardTitle>
                  <div className="text-3xl font-bold">$499</div>
                  <CardDescription>per month, billed annually</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Unlimited SKUs</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Unlimited users</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Custom integrations</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Dedicated account manager</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>24/7 phone support</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>SLA guarantee</span>
                    </li>
                  </ul>
                  <Button className="mt-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                    Start Free Trial
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Custom</CardTitle>
                  <div className="text-3xl font-bold">Let&apos;s talk</div>
                  <CardDescription>Tailored for your needs</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Custom deployment</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>On-premise option</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Custom features</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Training & onboarding</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                      <span>Priority support</span>
                    </li>
                  </ul>
                  <Button className="mt-6 w-full bg-transparent" variant="outline">
                    Contact Sales
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 py-20 text-white">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-4xl text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to transform your inventory operations?
              </h2>
              <p className="mb-8 text-xl opacity-90">
                Join thousands of businesses that trust Inventioo to manage their inventory efficiently.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Link href="/register">
                  <Button size="lg" variant="secondary" className="px-8 py-4 text-lg">
                    Start Free 14-Day Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="#demo">
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white bg-transparent text-white hover:bg-white/10 px-8 py-4 text-lg"
                  >
                    Schedule Demo
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center justify-center gap-8 text-sm opacity-75">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  <span>SOC 2 Certified</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span>GDPR Compliant</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>99.9% Uptime</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-slate-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold">Inventioo</span>
              </div>
              <p className="text-sm text-slate-400">
                Enterprise inventory management platform trusted by thousands of businesses worldwide.
              </p>
              <div className="flex gap-4">
                <Badge variant="secondary">SOC 2 Certified</Badge>
                <Badge variant="secondary">GDPR Compliant</Badge>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#features" className="text-slate-400 hover:text-white transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="text-slate-400 hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#integrations" className="text-slate-400 hover:text-white transition-colors">
                    Integrations
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    API Documentation
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    Press
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Support</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    Help Center
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    System Status
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    Security
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-slate-400">© {new Date().getFullYear()} Inventioo. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
