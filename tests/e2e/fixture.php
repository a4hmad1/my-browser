<?php
require __DIR__.'/../../backend/vendor/autoload.php';
$app=require __DIR__.'/../../backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(!$app->environment('local','testing'))throw new RuntimeException('UI fixtures require a development environment.');
$email=$argv[2]??'';
if(!preg_match('/^(ui|desktop)-[0-9]+@example\.com$/',$email))throw new RuntimeException('Only test fixture emails are allowed.');
$user=App\Models\User::where('email',$email)->firstOrFail();
if(($argv[1]??'')==='admin')$user->forceFill(['is_admin'=>true])->save();
elseif(($argv[1]??'')==='verified')$user->forceFill(['telegram_id'=>'test-'.$user->id,'telegram_verified_at'=>now()])->save();
elseif(in_array(($argv[1]??''),['plus','pro']))$user->forceFill(['plan'=>$argv[1],'subscription_ends_at'=>now()->addMonth(),'telegram_id'=>'test-'.$user->id,'telegram_verified_at'=>now()])->save();
elseif(($argv[1]??'')==='delete'){
 Illuminate\Support\Facades\DB::table('admin_events')->where('admin_id',$user->id)->orWhere('user_id',$user->id)->delete();
 Illuminate\Support\Facades\DB::table('sessions')->where('user_id',$user->id)->delete();
 $user->delete();
}
