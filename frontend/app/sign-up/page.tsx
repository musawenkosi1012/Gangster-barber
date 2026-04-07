import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      {/* Decorative background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
           <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase text-white mb-2 leading-[0.8]">Join the<br /><span className="text-red-600 italic">Elite.</span></h1>
           <p className="text-white/30 text-[10px] font-bold tracking-[0.4em] uppercase mt-4">The Syndicate Pro Series</p>
        </div>
        
        <SignUp 
          appearance={{
            elements: {
              formButtonPrimary: "bg-red-600 hover:bg-red-700 text-sm normal-case font-bold",
              card: "bg-white/5 border border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden rounded-3xl",
              headerTitle: "text-white hidden",
              headerSubtitle: "text-white/60 hidden",
              socialButtonsBlockButton: "bg-white/5 border border-white/10 text-white hover:bg-white/10",
              socialButtonsBlockButtonText: "text-white font-medium",
              dividerLine: "bg-white/10",
              dividerText: "text-white/40",
              formFieldLabel: "text-white/60 uppercase text-[10px] font-black tracking-widest",
              formFieldInput: "bg-white/5 border border-white/10 text-white rounded-xl focus:border-red-600 focus:bg-white/10 transition-all text-sm",
              footerActionLink: "text-red-600 hover:text-red-500",
              footerActionText: "text-white/40",
              header: "hidden",
            }
          }}
        />
      </div>
    </div>
  );
}
