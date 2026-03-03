import imgImage from "@/assets/images/AUSS_logo.png";
import imgEmail from "@/assets/images/email.png";
import imgLinkin from "@/assets/images/linkedin.png";
import imgFacebook from "@/assets/images/facebook.png";
import imgInstagram from "@/assets/images/instagram.png";
import imgTiktok from "@/assets/images/tiktok.png";
import imgDiscord from "@/assets/images/discord.png";
import imgEmailSendRemovebgPreview1 from "@/assets/images/email_send.png";

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

function NameInput() {
  return (
    <div className="relative rounded-[10px] shrink-0 w-full" data-name="NameInput">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-start px-[17px] relative w-full">
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[80px] not-italic relative shrink-0 text-[32px] text-white tracking-[1.6px]">Name</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#989898] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function EmailInpnut() {
  return (
    <div className="relative rounded-[10px] shrink-0 w-full" data-name="EmailInpnut">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-start px-[17px] relative w-full">
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[80px] not-italic relative shrink-0 text-[32px] text-white tracking-[1.6px]">Email</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#989898] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function SubjectInput() {
  return (
    <div className="relative rounded-[10px] shrink-0 w-full" data-name="SubjectInput">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-start px-[17px] relative w-full">
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[80px] not-italic relative shrink-0 text-[32px] text-white tracking-[1.6px]">Subject</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#989898] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function MessageInput() {
  return (
    <div className="h-[282px] relative rounded-[10px] shrink-0 w-full" data-name="MessageInput">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-start px-[17px] relative size-full">
          <p className="font-['Inter:Bold',sans-serif] font-bold leading-[80px] not-italic relative shrink-0 text-[32px] text-white tracking-[1.6px]">Message</p>
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[#989898] border-solid inset-0 pointer-events-none rounded-[10px]" />
    </div>
  );
}

function Send() {
  return (
    <div className="content-stretch flex gap-[10px] h-[46px] items-start relative shrink-0 w-[602px]" data-name="Send">
      <div className="bg-[#eb7524] relative rounded-[8px] shrink-0 w-[170px]" data-name="Button">
        <div className="content-stretch flex items-center justify-between overflow-clip p-[12px] relative rounded-[inherit] w-full">
          <p className="font-['Inter:Extra_Bold',sans-serif] font-extrabold leading-none not-italic relative shrink-0 text-[#f5f5f5] text-[20px]">Send Message</p>
        </div>
        <div aria-hidden="true" className="absolute border border-[#2c2c2c] border-solid inset-0 pointer-events-none rounded-[8px]" />
      </div>
      <div className="aspect-[258/195] h-full relative shrink-0" data-name="email_send-removebg-preview 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgEmailSendRemovebgPreview1} />
      </div>
    </div>
  );
}

function ContactForm() {
  return (
    <div className="bg-[#1e1e1e] content-stretch flex flex-col gap-[10px] h-[740px] items-start overflow-clip px-[20px] relative rounded-[50px] shrink-0 w-[644px]" data-name="ContactForm">
      <p className="decoration-[#eb7524] decoration-solid font-['Inter:Bold',sans-serif] font-bold leading-[80px] not-italic relative shrink-0 text-[32px] text-white tracking-[1.6px] underline">Send us a message</p>
      <NameInput />
      <EmailInpnut />
      <SubjectInput />
      <MessageInput />
      <Send />
    </div>
  );
}

function IconGroup1() {
  return (
    <div className="content-stretch flex flex-col gap-[50px] h-[720px] items-center overflow-clip px-[6px] relative shrink-0 w-[374px]" data-name="IconGroup">
      <div className="flex-[1_0_0] min-h-px min-w-px relative w-[50px]" data-name="Email">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgEmail} />
      </div>
      <div className="flex-[1_0_0] min-h-px min-w-px relative w-[50px]" data-name="Linkin">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgLinkin} />
      </div>
      <div className="flex-[1_0_0] min-h-px min-w-px relative w-[50px]" data-name="Facebook">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgFacebook} />
      </div>
      <div className="flex-[1_0_0] min-h-px min-w-px relative w-[50px]" data-name="Instagram">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgInstagram} />
      </div>
      <div className="flex-[1_0_0] min-h-px min-w-px relative w-[50px]" data-name="Tiktok">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgTiktok} />
      </div>
      <div className="flex-[1_0_0] min-h-px min-w-px relative w-[50px]" data-name="Discord">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgDiscord} />
      </div>
    </div>
  );
}

function QuickLinks() {
  return (
    <div className="bg-[#1e1e1e] content-stretch flex h-[740px] items-start overflow-clip p-[10px] relative rounded-[50px] shrink-0" data-name="QuickLinks">
      <IconGroup1 />
    </div>
  );
}

function ContactContainer() {
  return (
    <div className="-translate-x-1/2 -translate-y-1/2 absolute content-stretch flex gap-[10px] items-center left-1/2 overflow-clip p-[10px] top-1/2 w-[1070px]" data-name="ContactContainer">
      <ContactForm />
      <QuickLinks />
    </div>
  );
}

function ContactSection() {
  return (
    <div className="-translate-x-1/2 absolute bg-[#eb7524] h-[798px] left-1/2 overflow-clip top-[80px] w-[1440px]" data-name="ContactSection">
      <ContactContainer />
    </div>
  );
}

export default function Social() {
  return (
    <div className="bg-white relative size-full" data-name="Social">
      <div className="-translate-x-1/2 absolute bg-[#101010] h-[80px] left-1/2 overflow-clip shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] top-0 w-[1440px]" data-name="Default-Navbar">
        <NavContainer />
      </div>
      <div className="absolute bg-[rgba(0,0,0,0.94)] h-[146px] left-0 overflow-clip top-[878px] w-[1440px]" data-name="Footer-Section">
        <FooterContainer />
      </div>
      <ContactSection />
    </div>
  );
}