import imgDiscordNew from "@/assets/images/discord.png";
import imgLinkedIn from "@/assets/images/linkedin.png";
import imgFacebook from "@/assets/images/facebook.png";
import imgTikTok from "@/assets/images/tiktok.png";
import imgEmail from "@/assets/images/email.png";
import imgInstagram from "@/assets/images/instagram.png";
import imgImage1 from "@/assets/images/AUSS_logo.png";
import imgExpandArrow from "@/assets/images/email_send.png";
import imgAussLogo1 from "@/assets/images/AUSS_logo.png";

function Socials() {
  return (
    <div className="absolute h-[53px] left-[502px] top-[83px] w-[436px]" data-name="Socials">
      <div className="absolute h-[53px] left-[377px] top-0 w-[59px]" data-name="Discord New">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgDiscordNew} />
      </div>
      <div className="absolute h-[53px] left-[75px] top-0 w-[59px]" data-name="LinkedIn">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgLinkedIn} />
      </div>
      <div className="absolute h-[53px] left-[150px] top-0 w-[60px]" data-name="Facebook">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgFacebook} />
      </div>
      <div className="absolute h-[53px] left-[301px] top-0 w-[60px]" data-name="TikTok">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgTikTok} />
      </div>
      <div className="absolute h-[53px] left-0 top-0 w-[59px]" data-name="Email">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgEmail} />
      </div>
      <div className="absolute h-[53px] left-[226px] top-0 w-[59px]" data-name="Instagram">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgInstagram} />
      </div>
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents left-[34px] top-[27px]">
      <p className="-translate-x-1/2 absolute left-[78.5px] text-[15px] top-[28px]">Membership</p>
      <p className="-translate-x-1/2 absolute left-[295.5px] text-[15px] top-[27px]">Sponsorship</p>
      <p className="-translate-x-1/2 absolute left-[187px] text-[14px] top-[28px]">Media/Photos</p>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents left-[105px] text-[15px] top-[5px]">
      <p className="-translate-x-1/2 absolute left-[126px] top-[5px]">Home</p>
      <p className="-translate-x-1/2 absolute left-[186.5px] top-[5px]">About</p>
      <p className="-translate-x-1/2 absolute left-[247.5px] top-[5px]">Social</p>
    </div>
  );
}

function Items() {
  return (
    <div className="absolute font-['Inter:Regular',sans-serif] font-normal h-[54px] leading-[normal] left-[541px] not-italic text-center text-white top-[-13px] w-[374px]" data-name="Items">
      <Group1 />
      <Group />
    </div>
  );
}

function Footer() {
  return (
    <div className="absolute h-[187px] left-[-1px] top-[1590px] w-[1440px]" data-name="Footer">
      <div className="absolute bg-[#141414] h-[216px] left-0 top-[-29px] w-[1440px]" data-name="Footer" />
      <p className="-translate-x-1/2 absolute font-['Inter:Regular',sans-serif] font-normal leading-[normal] left-[720px] not-italic text-[14px] text-center text-white top-[157px]">@ 2026 Auckland University Strength Society</p>
      <Socials />
      <Items />
      <div className="absolute h-0 left-[502px] top-[62px] w-[436px]" data-name="split">
        <div className="absolute inset-[-2px_0_0_0]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 436 2">
            <line id="split" stroke="var(--stroke-0, white)" strokeWidth="2" x2="436" y1="1" y2="1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function WhyJoinAuss() {
  return (
    <div className="absolute h-[402px] leading-[normal] left-0 text-white top-[938px] w-[869px] whitespace-pre-wrap" data-name="Why join AUSS">
      <div className="absolute font-['Outfit:Regular',sans-serif] font-normal h-[241px] left-0 text-[20px] top-[50px] w-[869px]">
        <p className="mb-0">Joining Auckland University Strength Society (AUSS) means becoming part of a welcoming and driven community of students who share a passion for strength, fitness, and self-improvement. Whether you’re stepping into the gym for the first time or already experienced in training, you’ll find a supportive environment where everyone encourages each other to grow.</p>
        <p className="mb-0">&nbsp;</p>
        <p className="mb-0">AUSS provides opportunities to improve your knowledge of strength training through shared experience, guidance from fellow members, and community-based learning. You’ll be able to connect with training partners, attend events, and take part in activities that keep you motivated and consistent throughout the semester.</p>
        <p className="mb-0">&nbsp;</p>
        <p>Beyond physical progress, AUSS is about building confidence, friendships, and a sense of belonging at university. It’s not just about lifting weights — it’s about lifting each other up and creating a strong, positive community both inside and outside the gym.</p>
      </div>
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[50px] left-0 text-[25px] top-0 w-[176px]">Why join AUSS?</p>
    </div>
  );
}

function MeetTheTeam() {
  return (
    <div className="absolute h-[51px] left-0 top-[236px] w-[193px]" data-name="Meet the team">
      <div className="absolute bg-[#eb7524] h-[51px] left-0 rounded-[100px] top-0 w-[176px]" />
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium leading-[normal] left-[27px] text-[18px] text-white top-[14px]">Meet the Execs</p>
    </div>
  );
}

function MeetTheTeam1() {
  return (
    <div className="absolute border border-black border-solid h-[51px] left-[193px] top-[236px] w-[90px]" data-name="Meet the team">
      <div className="absolute bg-black border border-[#eb7524] border-solid h-[51px] left-[-1px] rounded-[100px] top-[-1px] w-[89px]" />
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium leading-[normal] left-[26px] text-[18px] text-white top-[13px]">FAQ</p>
    </div>
  );
}

function AboutUsSection() {
  return (
    <div className="absolute h-[318px] left-0 top-0 w-[869px]" data-name="About us section">
      <MeetTheTeam />
      <MeetTheTeam1 />
      <p className="absolute font-['Outfit:Regular',sans-serif] font-normal h-[241px] leading-[normal] left-0 text-[20px] text-white top-[77px] w-[869px] whitespace-pre-wrap">{`The Auckland University Strength Society, originally established as the Auckland University Strength & Powerlifting Association (AUSPA), was founded in 2015. It began as a student-led initiative to create a community for University of Auckland students interested in strength training and powerlifting, and has since grown into a broader strength and fitness society supporting members of all experience levels.`}</p>
      <p className="absolute font-['Outfit:Medium',sans-serif] font-medium h-[77px] leading-[normal] left-0 text-[55px] text-white top-0 w-[276px] whitespace-pre-wrap">About Us.</p>
    </div>
  );
}

function Container() {
  return (
    <div className="absolute h-[1340px] left-[292px] top-[167px] w-[869px]" data-name="Container">
      <WhyJoinAuss />
      <div className="absolute flex h-[579px] items-center justify-center left-0 top-[318px] w-[869px]">
        <div className="-scale-y-100 flex-none rotate-180">
          <div className="h-[579px] relative rounded-[36px] w-[869px]" data-name="image 1">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[36px] size-full" src={imgImage1} />
          </div>
        </div>
      </div>
      <AboutUsSection />
    </div>
  );
}

function Links() {
  return (
    <div className="absolute h-[34px] left-[225px] top-[16px] w-[127px]" data-name="Links">
      <div className="absolute h-[20px] left-[90px] top-[10px] w-[23px]" data-name="Expand Arrow">
        <img alt="" className="absolute inset-0 max-w-none object-contain pointer-events-none size-full" src={imgExpandArrow} />
      </div>
      <p className="-translate-x-1/2 absolute font-['Outfit:Regular',sans-serif] font-normal leading-[normal] left-[53px] text-[27px] text-center text-white top-0 w-[106px] whitespace-pre-wrap">Links</p>
    </div>
  );
}

function ItemGroup() {
  return (
    <div className="absolute h-[66px] left-[625px] overflow-clip top-0 w-[471px]" data-name="Item Group">
      <p className="-translate-x-1/2 absolute font-['Outfit:Regular',sans-serif] font-normal leading-[normal] left-[66px] text-[27px] text-center text-white top-[16px] w-[106px] whitespace-pre-wrap">Home</p>
      <p className="-translate-x-1/2 absolute font-['Outfit:Regular',sans-serif] font-normal leading-[normal] left-[405px] text-[27px] text-center text-white top-[16px] w-[106px] whitespace-pre-wrap">Socials</p>
      <p className="-translate-x-1/2 absolute font-['Outfit:Regular',sans-serif] font-normal leading-[normal] left-[172px] text-[27px] text-center text-white top-[16px] w-[106px] whitespace-pre-wrap">About</p>
      <Links />
    </div>
  );
}

function Container1() {
  return (
    <div className="absolute h-[66px] left-[95px] overflow-clip top-[7px] w-[1240px]" data-name="Container">
      <ItemGroup />
      <div className="absolute left-[137px] rounded-[381.5px] size-[62px] top-[2px]" data-name="auss logo 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none rounded-[381.5px] size-full" src={imgAussLogo1} />
      </div>
    </div>
  );
}

function NavbarJayden({ className }: { className?: string }) {
  return (
    <div className={className || "absolute bg-black h-[85px] left-[-2px] top-[-1px] w-[1440px]"} data-name="Navbar - Jayden">
      <div className="overflow-clip relative rounded-[inherit] size-full">
        <Container1 />
      </div>
      <div aria-hidden="true" className="absolute border-[rgba(255,255,255,0.42)] border-b-[1.5px] border-solid inset-[0_0_-1.5px_0] pointer-events-none" />
    </div>
  );
}

export default function About() {
  return (
    <div className="bg-black border border-black border-solid relative size-full" data-name="About">
      <Footer />
      <Container />
      <NavbarJayden />
    </div>
  );
}