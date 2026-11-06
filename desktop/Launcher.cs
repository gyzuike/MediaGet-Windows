using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
[assembly: AssemblyTitle("MediaGet")]
[assembly: AssemblyProduct("MediaGet Windows")]
[assembly: AssemblyVersion("0.1.24.0")]
class Launcher {
 [STAThread] static void Main() {
  Application.EnableVisualStyles();
  string buildKey;
  using(var stream=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
  using(var hash=System.Security.Cryptography.SHA256.Create()) buildKey=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").Substring(0,16);
  string root=Environment.GetEnvironmentVariable("MEDIAGET_EXTRACT_DIR");
  if(string.IsNullOrEmpty(root))root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MediaGetDesktop","build-"+buildKey);
  try {
   using(var mutex=new Mutex(false,"Local\\MediaGetExtract"+buildKey)){
    if(!mutex.WaitOne(TimeSpan.FromMinutes(5)))throw new Exception("另一个 MediaGet 正在准备文件，请稍后重试。");
    try {
     if(!File.Exists(Path.Combine(root,".ready"))){
      var form=new Form {Text="MediaGet",Width=420,Height=140,StartPosition=FormStartPosition.CenterScreen,FormBorderStyle=FormBorderStyle.FixedDialog,MaximizeBox=false,MinimizeBox=false,ControlBox=false,Icon=System.Drawing.Icon.ExtractAssociatedIcon(Application.ExecutablePath)};
      form.Controls.Add(new Label {Text="首次运行正在准备组件，请稍候……",Left=25,Top=20,Width=370});
      form.Controls.Add(new ProgressBar {Left=25,Top=55,Width=350,Style=ProgressBarStyle.Marquee});
      Exception error=null;
      form.Shown+=(s,e)=>Task.Run(()=>{
       try {
        Directory.CreateDirectory(root);
        using(var input=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
        using(var zip=new ZipArchive(input,ZipArchiveMode.Read)){
         foreach(var entry in zip.Entries){
          string target=Path.GetFullPath(Path.Combine(root,entry.FullName));
          if(!target.StartsWith(Path.GetFullPath(root)+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase))throw new Exception("安装包路径无效。");
          if(entry.Name.Length==0){Directory.CreateDirectory(target);continue;}
          Directory.CreateDirectory(Path.GetDirectoryName(target));
          using(var src=entry.Open())using(var dst=File.Create(target))src.CopyTo(dst);
         }
        }
        File.WriteAllText(Path.Combine(root,".ready"),"0.1.24-default-tiktok1");
       }catch(Exception ex){error=ex;}
       form.BeginInvoke(new Action(()=>form.Close()));
      });
      Application.Run(form);if(error!=null)throw error;
     }
    }finally{mutex.ReleaseMutex();}
   }
   var start=new ProcessStartInfo(Path.Combine(root,"MediaGet.exe")){WorkingDirectory=root,UseShellExecute=false};
   if(Environment.GetEnvironmentVariable("MEDIAGET_SMOKE_NO_SANDBOX")=="1")start.Arguments="--no-sandbox";
   Process.Start(start);
  }catch(Exception e){if(Environment.GetEnvironmentVariable("MEDIAGET_PROGRESS_PROBE")!=null){File.WriteAllText(Environment.GetEnvironmentVariable("MEDIAGET_PROGRESS_PROBE"),e.ToString());Environment.Exit(1);}MessageBox.Show("MediaGet 启动失败："+e.Message,"MediaGet",MessageBoxButtons.OK,MessageBoxIcon.Error);Environment.ExitCode=1;}
 }
}





