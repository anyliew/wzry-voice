import { execSync } from 'child_process'
import fs from 'fs'

export class WzryVoiceUpdater extends plugin {
  constructor() {
    super({
      name: 'Wzry-Voice-Updater',
      dsc: '更新 wzry-voice 插件仓库',
      event: 'message',
      priority: 10,
      rule: [
        {
          reg: '^#?wzry(强制)?更新$',   // 匹配 #wzry更新 或 #wzry强制更新，不区分大小写
          fnc: 'updateWzryVoice',
          permission: 'master'
        }
      ]
    })
  }

  async updateWzryVoice(e) {
    const startTime = new Date()
    const startTimeStr = startTime.toLocaleString('zh-CN')
    
    // 判断是否为强制更新模式
    const isForce = e.msg.includes('强制更新')
    const modeText = isForce ? '强制更新' : '普通更新'
    
    // 收集所有输出信息
    const logLines = [
      `🔄 开始执行 wzry-voice 插件更新任务（${modeText}模式）`,
      `⏰ 开始时间: ${startTimeStr}`,
      `========================`
    ]

    const pluginRepos = [
      {
        name: 'wzry-voice',
        path: './plugins/wzry-voice/'
      }
    ]

    const resultMsgs = []      // 保留详细结果（用于最终转发）
    let hasUpdate = false
    let successCount = 0
    let failCount = 0
    let updateCount = 0

    for (let i = 0; i < pluginRepos.length; i++) {
      const repo = pluginRepos[i]
      logLines.push(`📦 [${i+1}/${pluginRepos.length}] 正在${modeText} ${repo.name}...`)

      try {
        // 1. 检查插件路径是否存在
        if (!fs.existsSync(repo.path)) {
          const errorMsg = `❌ ${repo.name} 路径不存在: ${repo.path}`
          resultMsgs.push(errorMsg)
          failCount++
          logLines.push(`❌ [${i+1}/${pluginRepos.length}] ${repo.name} 路径不存在`)
          continue
        }

        // 2. 获取当前版本（旧 HEAD）
        const oldHead = execSync('git rev-parse HEAD', { 
          cwd: repo.path,
          encoding: 'utf-8'
        }).toString().trim()
        const oldHashShort = oldHead.substring(0, 8)

        // 3. 获取当前分支名（用于强制更新时 reset）
        let currentBranch = 'main'
        try {
          currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: repo.path,
            encoding: 'utf-8'
          }).toString().trim()
        } catch (err) {
          // 如果处于 detached HEAD 状态，尝试从远程获取默认分支
          logLines.push(`⚠️ 无法获取当前分支，将尝试使用 origin/HEAD 指向的分支`)
          try {
            const symbolicRef = execSync('git symbolic-ref refs/remotes/origin/HEAD', {
              cwd: repo.path,
              encoding: 'utf-8'
            }).toString().trim()
            currentBranch = symbolicRef.replace('refs/remotes/origin/', '')
          } catch (e) {
            currentBranch = 'main' // 最终 fallback
          }
        }

        // 4. 执行更新（普通 pull 或强制 fetch+reset）
        let updateExecuted = false
        if (isForce) {
          // 强制更新：fetch 所有远程分支，然后硬重置到 origin/当前分支
          execSync('git fetch --all', { cwd: repo.path, encoding: 'utf-8' })
          execSync(`git reset --hard origin/${currentBranch}`, { cwd: repo.path, encoding: 'utf-8' })
          // 可选：清理未跟踪的文件（如果需要完全干净，可取消注释下一行）
          // execSync('git clean -fd', { cwd: repo.path, encoding: 'utf-8' })
          updateExecuted = true
        } else {
          // 普通更新
          execSync('git pull', { cwd: repo.path, encoding: 'utf-8' })
          updateExecuted = true
        }
        
        // 5. 获取更新后版本（新 HEAD）
        const newHead = execSync('git rev-parse HEAD', { 
          cwd: repo.path,
          encoding: 'utf-8'
        }).toString().trim()
        const newHashShort = newHead.substring(0, 8)

        // 6. 检查是否有实际变更（代码更新或强制重置导致 hash 变化）
        if (oldHead === newHead && !isForce) {
          // 普通模式下无更新
          resultMsgs.push(`✅ ${repo.name} 无更新 (${oldHashShort})`)
          successCount++
          logLines.push(`✅ [${i+1}/${pluginRepos.length}] ${repo.name} 无更新 (${oldHashShort})`)
        } else if (oldHead === newHead && isForce) {
          // 强制模式下 hash 相同但可能本地有未提交修改已被丢弃？实际上 reset --hard 会改变 hash 吗？
          // 如果本地没有任何未提交修改且远端无新提交，reset 后 hash 仍相同，此时应视为“已强制同步，无远端新提交”
          hasUpdate = true
          updateCount++
          const updateMsg = `🔄 ${repo.name} 已强制同步（远端无新提交，本地已重置至 ${oldHashShort}）`
          resultMsgs.push(updateMsg)
          successCount++
          logLines.push(`✅ [${i+1}/${pluginRepos.length}] ${repo.name} 强制同步完成 (无远端变化)`)
        } else {
          // 有实际更新（hash 变化）
          hasUpdate = true
          updateCount++
          
          // 获取更新的文件列表
          let updatedFiles = []
          try {
            updatedFiles = execSync(`git diff --name-only ${oldHead} ${newHead}`, {
              cwd: repo.path,
              encoding: 'utf-8'
            })
              .toString()
              .trim()
              .split('\n')
              .filter(file => file.length > 0)
          } catch (err) {
            updatedFiles = ['无法获取详细文件列表']
          }

          // 获取提交日志
          let commitHistory = ''
          try {
            commitHistory = execSync(
              `git log --date=short --pretty=format:"• %ad: %s - %an" ${oldHead}..${newHead}`,
              { 
                cwd: repo.path,
                encoding: 'utf-8'
              }
            ).toString().trim()
          } catch (err) {
            commitHistory = '无法获取提交日志'
          }

          // 构建详细更新信息
          let updateMsg = `🔄 ${repo.name} 已${modeText}\n`
          if (isForce) updateMsg += `   ⚠️ 已丢弃所有本地变更，强制同步至远端\n`
          updateMsg += `    📍 ${oldHashShort} → ${newHashShort}\n`
          updateMsg += `    📊 变更文件数: ${updatedFiles.length}\n`
          
          if (commitHistory && commitHistory !== '无法获取提交日志') {
            const commitLines = commitHistory.split('\n')
            const displayCommits = commitLines.slice(0, 5)
            updateMsg += `    📝 提交记录 (前5条):\n${displayCommits.map(l => `       ${l}`).join('\n')}`
            if (commitLines.length > 5) {
              updateMsg += `\n       ... 还有 ${commitLines.length - 5} 条`
            }
          }
          
          if (updatedFiles.length > 0 && updatedFiles[0] !== '无法获取详细文件列表') {
            const displayedFiles = updatedFiles.slice(0, 10)
            updateMsg += `\n    📄 更新的文件 (前10个):\n${displayedFiles.map(file => `       - ${file}`).join('\n')}`
            if (updatedFiles.length > 10) {
              updateMsg += `\n       ... 还有 ${updatedFiles.length - 10} 个文件`
            }
          }
          
          resultMsgs.push(updateMsg)
          successCount++
          logLines.push(`✅ [${i+1}/${pluginRepos.length}] ${repo.name} 更新完成 (${oldHashShort} → ${newHashShort})`)
        }
      } catch (err) {
        let errorMsg = `❌ ${repo.name} 更新失败: ${err.message}`
        
        if (err.message.includes('not a git repository')) {
          errorMsg += '\n原因：目录不是 git 仓库'
        } else if (err.message.includes('Could not resolve host')) {
          errorMsg += '\n原因：网络连接失败，无法访问远程仓库'
        } else if (err.message.includes('Authentication failed')) {
          errorMsg += '\n原因：认证失败，请检查权限配置'
        } else if (err.message.includes('cannot be used without a working tree')) {
          errorMsg += '\n原因：Git 工作树异常'
        }
        
        resultMsgs.push(errorMsg)
        failCount++
        logLines.push(`❌ [${i+1}/${pluginRepos.length}] ${repo.name} 更新失败: ${err.message}`)
      }
    }

    // 统计汇总
    logLines.push(`📊 仓库更新统计: 成功 ${successCount} | 失败 ${failCount} | 有更新 ${updateCount}`)

    // 最终结果消息
    const endTime = new Date()
    const totalTime = (endTime - startTime) / 1000
    const endTimeStr = endTime.toLocaleString('zh-CN')
    
    let summary = [
      '========================',
      '📋 更新任务执行完成',
      `⏰ ${startTimeStr} → ${endTimeStr} (${totalTime.toFixed(2)}秒)`,
      `📊 成功:${successCount} 失败:${failCount} 更新:${updateCount}`,
      '========================',
      ...logLines,
      '========================'
    ]
    
    if (hasUpdate) {
      summary.push(`🔄 检测到更新，已成功拉取最新代码`)
    } else {
      summary.push(`✅ 所有仓库均无更新`)
    }
    summary.push(...resultMsgs)
    
    const finalMessage = summary.join('\n')
    
    // 发送合并转发消息
    try {
      const botInfo = e.bot || {}
      const botUserId = botInfo.uin || 10000
      const botNickname = botInfo.nickname || '语音酱'
      const forward = await e.group.makeForwardMsg([
        { user_id: botUserId, nickname: botNickname, message: finalMessage }
      ])
      await e.reply(forward)
    } catch (forwardErr) {
      console.error('创建转发消息失败:', forwardErr)
      await e.reply(finalMessage)
    }
  }
}