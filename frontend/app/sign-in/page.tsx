import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Premium Gradient Backgrounds */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-red-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <SignIn 
          appearance={{
            baseTheme: dark,
            elements: {
              rootBox: "w-full",
              cardBox: "w-full",
              card: "bg-[#1f1f1f] border border-white/5 shadow-2xl rounded-3xl p-8",
              headerTitle: "text-white text-2xl font-black tracking-tighter uppercase",
              headerSubtitle: "text-white/40 text-[10px] font-bold tracking-[0.3em] uppercase",
              formButtonPrimary: "bg-white hover:bg-white/90 text-black text-xs font-black uppercase tracking-widest py-4 rounded-full transition-all duration-300",
              socialButtonsBlockButton: "bg-transparent border border-white/10 hover:bg-white/5 p-3 rounded-2xl transition-all duration-300",
              socialButtonsBlockButtonText: "text-white/70 font-bold tracking-tight text-xs",
              formFieldLabel: "text-white/40 uppercase text-[9px] font-black tracking-widest mb-2 ml-1",
              formFieldInput: "bg-[#252525] border border-white/5 text-white rounded-2xl px-5 py-4 focus:border-white/20 focus:bg-[#2a2a2a] transition-all text-sm font-medium",
              dividerLine: "bg-white/5",
              dividerText: "text-white/20 uppercase text-[9px] font-black tracking-widest",
              footerActionLink: "text-white hover:text-white/80 font-black",
              footerActionText: "text-white/40 font-bold",
              identityPreviewText: "text-white",
              identityPreviewEditButtonIcon: "text-white/60",
              formFieldErrorText: "text-red-500 font-bold text-[10px] uppercase tracking-widest mt-2 ml-1",
            }
          }}
        />
      </div>
    </div>
  );
}

