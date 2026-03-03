import imgEmail from "@/assets/images/email.png";
import imgLinkin from "@/assets/images/linkedin.png";
import imgFacebook from "@/assets/images/facebook.png";
import imgInstagram from "@/assets/images/instagram.png";
import imgTiktok from "@/assets/images/tiktok.png";
import imgDiscord from "@/assets/images/discord.png";
import imgImage from "@/assets/images/AUSS_logo.png";

function IconGroup() {
  return (
    <div className="h-[35px] relative shrink-0 w-full" data-name="IconGroup">
      <div className="flex flex-row justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex gap-[50px] items-start justify-center px-[6px] relative size-full">
          <div className="h-full relative shrink-0 w-[50px]" data-name="Email">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgEmail} />
          </div>
          <div className="h-full relative shrink-0 w-[50px]" data-name="Linkin">
            <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgLinkin} />
          </div>
          <div className="h-full relative shrink-0 w-[50px]" data-name="Facebook">
            <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgFacebook} />
          </div>
          <div className="h-full relative shrink-0 w-[50px]" data-name="Instagram">
            <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgInstagram} />
          </div>
          <div className="h-full relative shrink-0 w-[50px]" data-name="Tiktok">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgTiktok} />
          </div>
          <div className="h-full relative shrink-0 w-[50px]" data-name="Discord">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgDiscord} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterContainer() {
  return (
    <div className="-translate-x-1/2 absolute content-stretch flex flex-col gap-[10px] h-[194px] items-center left-1/2 overflow-clip p-[10px] top-0 w-[1200px]" data-name="FooterContainer">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white w-[1200px] whitespace-pre-wrap">
        Membership · Media/Photos · Sponsorship
        <br aria-hidden="true" />
        <br aria-hidden="true" />
      </p>
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white w-[1200px] whitespace-pre-wrap">Home · About · Social</p>
      <IconGroup />
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white w-[1200px] whitespace-pre-wrap">© 2026 Auckland University Strength Society</p>
    </div>
  );
}

function FooterSection({ className }: { className?: string }) {
  return (
    <div className={className || "absolute bg-[rgba(0,0,0,0.94)] h-[146px] left-0 overflow-clip top-[878px] w-[1440px]"} data-name="Footer-Section">
      <FooterContainer />
    </div>
  );
}

function TextBlock() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] h-[400px] items-center justify-center overflow-clip relative shrink-0 w-[1200px]" data-name="TextBlock">
      <div className="flex flex-col font-['Inter:Regular',sans-serif] font-normal justify-end leading-[0] min-w-full not-italic relative shrink-0 text-[14px] text-black text-center tracking-[5.6px] w-[min-content]">
        <p className="leading-[30px] whitespace-pre-wrap">Auckland University Strength Society</p>
      </div>
      <div className="font-['Inter:Bold','Noto_Sans:Bold',sans-serif] font-bold leading-[80px] min-w-full not-italic relative shrink-0 text-[56px] text-black text-center tracking-[0.56px] w-[min-content] whitespace-pre-wrap">
        <p className="mb-0">{`A Community of `}</p>
        <p>Strength Athletes</p>
      </div>
      <div className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] min-w-full not-italic relative shrink-0 text-[18px] text-black text-center tracking-[0.18px] w-[min-content] whitespace-pre-wrap">
        <p className="mb-0">We bring together lifters, beginners, and athletes to train, compete, and progress together.</p>
        <p>Build strength in a supportive and driven community.</p>
      </div>
      <div className="bg-[#f5f5f5] relative rounded-[8px] shrink-0" data-name="Button">
        <div className="content-stretch flex gap-[8px] items-center justify-center overflow-clip p-[12px] relative rounded-[inherit]">
          <p className="font-['Inter:Extra_Bold',sans-serif] font-extrabold leading-none not-italic relative shrink-0 text-[#2c2c2c] text-[20px]">Join AUSS</p>
        </div>
        <div aria-hidden="true" className="absolute border border-[#2c2c2c] border-solid inset-0 pointer-events-none rounded-[8px]" />
      </div>
    </div>
  );
}

function ImageBlock() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[1200px]" data-name="ImageBlock">
      <div className="flex flex-row items-center size-full">
        <div className="size-full" />
      </div>
    </div>
  );
}

function HeroContainer() {
  return (
    <div className="-translate-x-1/2 absolute content-stretch flex flex-col h-[798px] items-center justify-between left-1/2 overflow-clip top-0 w-[1200px]" data-name="HeroContainer">
      <TextBlock />
      <ImageBlock />
    </div>
  );
}

function HeroSection() {
  return (
    <div className="absolute bg-[#eb7524] h-[798px] left-0 overflow-clip top-[80px] w-[1440px]" data-name="Hero-Section">
      <HeroContainer />
    </div>
  );
}

function NavGroup() {
  return (
    <div className="content-stretch flex font-['Inter:Regular',sans-serif] font-normal gap-[32px] h-[80px] items-center leading-[normal] not-italic relative shrink-0 text-[40px] text-white whitespace-pre-wrap" data-name="NavGroup">
      <p className="h-[47px] relative shrink-0 w-[120px]">Home</p>
      <p className="h-[47px] relative shrink-0 w-[120px]">About</p>
      <p className="h-[47px] relative shrink-0 w-[158px]">Links ▼</p>
      <p className="h-[47px] relative shrink-0 w-[156px]">Social</p>
    </div>
  );
}

function NavContainer() {
  return (
    <div className="-translate-x-1/2 absolute content-stretch flex h-[80px] items-start justify-between left-1/2 overflow-clip top-0 w-[1200px]" data-name="NavContainer">
      <div className="content-stretch flex flex-col items-center justify-between py-[8px] relative shrink-0 size-[80px]" data-name="Logo">
        <div className="relative shrink-0 size-[80px]" data-name="Image">
          <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage} />
        </div>
      </div>
      <NavGroup />
    </div>
  );
}

function DefaultNavbar({ className }: { className?: string }) {
  return (
    <div className={className || "absolute bg-[#101010] h-[80px] left-0 overflow-clip shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] top-0 w-[1440px]"} data-name="Default-Navbar">
      <NavContainer />
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-white relative size-full" data-name="Home">
      <FooterSection />
      <HeroSection />
      <DefaultNavbar />
    </div>
  );
}