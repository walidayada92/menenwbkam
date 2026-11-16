const { prisma } = require('./index');
const bcrypt = require('bcrypt');
async function main() {
  const plans=[
    {id:'free',name:'Free',nameAr:'مجاني',monthlyPrice:0,yearlyPrice:0,productLimit:10,features:{bulkUpload:false},trialDays:0,sortOrder:0},
    {id:'starter',name:'Starter',nameAr:'بداية',monthlyPrice:49,yearlyPrice:490,productLimit:100,features:{basicAnalytics:true},trialDays:7,sortOrder:1},
    {id:'pro',name:'Pro',nameAr:'احترافي',monthlyPrice:149,yearlyPrice:1490,productLimit:1000,features:{basicAnalytics:true,bulkUpload:true,priceHistory:true,featuredBadge:true},trialDays:7,sortOrder:2},
    {id:'business',name:'Business',nameAr:'أعمال',monthlyPrice:399,yearlyPrice:3990,productLimit:-1,features:{basicAnalytics:true,bulkUpload:true,priceHistory:true,featuredBadge:true,apiAccess:true,priorityPlacement:true,teamMembers:true},trialDays:7,sortOrder:3},
    {id:'enterprise',name:'Enterprise',nameAr:'مؤسسات',monthlyPrice:0,yearlyPrice:0,productLimit:-1,features:{apiAccess:true,teamMembers:true},trialDays:0,sortOrder:4,isCustom:true},
  ];
  // Preserve admin edits on subsequent runs. Migrate the original free-plan feature object once.
  for(const plan of plans) await prisma.plan.upsert({where:{id:plan.id},create:plan,update:{}});
  const free=await prisma.plan.findUnique({where:{id:'free'}});
  if(free?.features && free.features.listing===true && free.features.bulkUpload===undefined) await prisma.plan.update({where:{id:'free'},data:{nameAr:'مجاني',features:{bulkUpload:false}}});
  for(const brand of [{id:'apple',nameAr:'أبل',nameEn:'Apple'},{id:'samsung',nameAr:'سامسونج',nameEn:'Samsung'},{id:'sony',nameAr:'سوني',nameEn:'Sony'}]) await prisma.brand.upsert({where:{id:brand.id},create:brand,update:{}});
  for(const category of [{id:'phones',nameAr:'الهواتف',nameEn:'Phones'},{id:'computers',nameAr:'الحواسيب',nameEn:'Computers'},{id:'audio',nameAr:'الصوتيات',nameEn:'Audio'}]) await prisma.category.upsert({where:{id:category.id},create:category,update:{}});
  if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    if(process.env.ADMIN_PASSWORD.length<12 || Buffer.byteLength(process.env.ADMIN_PASSWORD)>72) throw new Error('ADMIN_PASSWORD must be at least 12 characters and at most 72 UTF-8 bytes');
    const email=process.env.ADMIN_EMAIL.toLowerCase().trim();
    const user=await prisma.user.findUnique({where:{email}});
    if(user && user.role!=='ADMIN') throw new Error('ADMIN_EMAIL belongs to a non-admin account');
    if(!user) await prisma.user.create({data:{email,passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD,12),role:'ADMIN',isVerified:true}});
  }
  console.log('Seed completed. Plan defaults are test prices, editable by admin. No sample offers or default passwords created.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>prisma.$disconnect());
