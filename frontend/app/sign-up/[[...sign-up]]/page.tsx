import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6 relative overflow-hidden">
      {/* Premium Brand Glows */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -right-[10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[140px]"></div>
        <div className="absolute -bottom-[10%] -left-[10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[140px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-10">
          <h2 className="text-white font-black tracking-tighter text-3xl mb-2">GANGSTER<span className="text-red-600">.</span></h2>
          <p className="text-white/30 text-[10px] uppercase font-bold tracking-[0.4em]">Join The Syndicate</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
